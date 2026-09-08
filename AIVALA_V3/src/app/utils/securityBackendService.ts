import { toast } from "sonner";
import { offlineStorage } from "./offlineStorage";
import {
  getHFSpaceURL,
  setHFSpaceURL,
  type DamageArea,
  type DetectionFrame,
  type DetectionItem,
  type FiveStageSecurityDetails,
  type HFAnalysisResult,
  type ScreenRecordingCheck,
} from "./huggingFaceService";
import { estimateRepairCost, type DamageContext } from "./repairCostEstimator";
import { computeFraudScore } from "./fraudScoreEngine";
import { auth } from "./firebase";
import { accountStorageKey, readAccountJson, writeAccountJson } from "./accountStorage";

export class SecurityGatewayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly category: "invalid_evidence" | "invalid_media" | "infrastructure",
  ) {
    super(message);
    this.name = "SecurityGatewayError";
  }
}

export function getSecurityBackendURL(): string {
  return getHFSpaceURL().replace(/\/+$/, "");
}

export function setSecurityBackendURL(url: string): void {
  localStorage.removeItem("security_backend_url");
  setHFSpaceURL(url);
}

export async function waitForSecurityGatewayReady(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(`${getSecurityBackendURL()}/`, {
      signal: controller.signal,
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    window.clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken().catch(() => undefined);
  return { "ngrok-skip-browser-warning": "true", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function analysisStorageKey(claimId: string): string {
  return accountStorageKey(`ai_analysis_${claimId}`);
}

export function readStoredAnalysis(claimId?: string): string | null {
  if (!claimId) return null;
  // Results are account-scoped so another signed-in user cannot read them.
  return localStorage.getItem(analysisStorageKey(claimId));
}

function severityToScore(severity = "none"): number {
  return ({
    none: 0,
    minor: 2,
    semi_minor: 3,
    moderate: 5,
    semi_moderate: 6,
    semi_severe: 8,
    severe: 9,
  } as Record<string, number>)[
    severity.toLowerCase()
  ] ?? 0;
}

export function normalizePipeline(raw: any): FiveStageSecurityDetails {
  const stage = (number: number, name: string, value: any): FiveStageSecurityDetails["stage1_exif"] => ({
    stage: Number(value?.stage) || number,
    name: String(value?.name || `Layer ${number}: ${name}`),
    shortName: String(value?.shortName || name),
    status: ["PASSED", "FAILED", "WARNING", "SKIPPED"].includes(value?.status) ? value.status : "SKIPPED",
    details: String(value?.details || "No result is available for this check."),
    metricLabel: value?.metricLabel,
    metricValue: value?.metricValue,
  });
  // Legacy records are mapped by meaning.  A legacy receipt cannot prove that
  // B's reverse search ran, so it remains unavailable rather than "passed".
  return {
    overallStatus: raw?.overallStatus || "FAILED",
    schemaVersion: Number(raw?.schema_version || raw?.schemaVersion || 1),
    timestamp:
      typeof raw?.timestamp === "number"
        ? new Date(raw.timestamp * 1000).toISOString()
        : raw?.timestamp || new Date().toISOString(),
    stage1_exif: stage(1, "Metadata and container integrity", raw?.stage1_exif),
    stage2_phash: stage(2, "Duplicate and motion fingerprint", raw?.stage2_phash),
    stage3_ela: stage(3, "Visual tampering", raw?.stage3_ela),
    stage4_deepfake: stage(4, "Face and liveness", raw?.stage4_deepfake),
    stage5_reverse_search: stage(5, "Public-web reverse search", raw?.stage5_reverse_search),
  };
}

export function parseStoredAnalysis(raw: string | null): HFAnalysisResult | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    return {
      ...value,
      detections: Array.isArray(value.detections) ? value.detections : [],
      detection_frames: Array.isArray(value.detection_frames) ? value.detection_frames : [],
      damageAreas: Array.isArray(value.damageAreas) ? value.damageAreas : [],
      modelReasoning: Array.isArray(value.modelReasoning) ? value.modelReasoning.map(String) : [],
      fiveStageSecurity: normalizePipeline(value.fiveStageSecurity),
    } as HFAnalysisResult;
  } catch {
    return null;
  }
}

function persistResult(claimId: string, result: HFAnalysisResult, flagged = false): void {
  localStorage.setItem(analysisStorageKey(claimId), JSON.stringify(result));
  const claims = readAccountJson<any[]>("claims", []);
  writeAccountJson(
    "claims",
    claims.map((claim: any) =>
        claim.id === claimId
          ? {
              ...claim,
              status: result.isRejected ? "rejected" : result.isNoDamage ? "no_damage" : flagged ? "review_required" : "approved",
              estimatedCost: result.estimatedCost,
              fraudScore: result.fraudScore,
              summary: result.summary,
              image: result.annotated_image || claim.image,
            }
          : claim,
      ),
  );
}

export async function verifyClaimWithSecurityBackend(
  fileBlobOrFile: Blob | File,
  claimId: string,
  onStatus?: (msg: string) => void,
  persistedFileName?: string,
): Promise<HFAnalysisResult & { cryptographicLedgerReceipt?: string }> {
  const endpoint = `${getSecurityBackendURL()}/verify-claim/`;
  const claimMeta = readAccountJson<Record<string, any>>(`claim_meta_${claimId}`, {});
  const reportedDamageType =
    Array.isArray(claimMeta.damageTypes) && claimMeta.damageTypes.length > 0
      ? claimMeta.damageTypes.join(", ")
      : (claimMeta.damageType || "unspecified");
  const damageContext: DamageContext = {
    location: claimMeta.damageContext?.location || "unspecified",
    partsCount: Number(claimMeta.damageContext?.partsCount) || 1,
    extent: claimMeta.damageContext?.extent || "localized",
    damageTypes: Array.isArray(claimMeta.damageTypes)
      ? claimMeta.damageTypes
      : claimMeta.damageType
        ? [claimMeta.damageType]
        : undefined,
    reportedDamageType,
  };

  const formData = new FormData();
  const filename =
    fileBlobOrFile instanceof File ? fileBlobOrFile.name : persistedFileName || `claim_${claimId}.${fileBlobOrFile.type.includes("webm") ? "webm" : "mp4"}`;
  formData.append("file", fileBlobOrFile, filename);
  formData.append("claim_id", claimId);
  formData.append("incident_datetime", claimMeta.date || "");
  formData.append("damage_location", damageContext.location);
  formData.append("damaged_parts_count", String(damageContext.partsCount));
  formData.append("damage_extent", damageContext.extent);
  formData.append("reported_damage_type", reportedDamageType);
  formData.append("incident_description", claimMeta.description || "");

  onStatus?.("Running local evidence checks and YOLO/Qwen analysis…");
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 300_000);
  let data: any;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
      headers: await authHeaders(),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let parsed: any = null;
      try {
        parsed = JSON.parse(body);
      } catch {
        // Not JSON
      }

      if (parsed && (parsed.status === "REJECTED_FRAUD" || parsed.status === "FRAUD_DETECTED")) {
        data = parsed;
      } else {
        if (response.status === 400 || response.status === 422) {
          throw new SecurityGatewayError(
            parsed?.status === "INVALID_MEDIA"
              ? "This recording could not be read. Please record the evidence again."
              : "Verification Failed: Evidence video did not pass security verification guidelines. Please record a new video.",
            response.status,
            false,
            parsed?.status === "INVALID_MEDIA" ? "invalid_media" : "invalid_evidence",
          );
        }

        throw new SecurityGatewayError(
          response.status === 401 || response.status === 403
            ? "Authentication is required to verify this claim."
            : "Damage analysis is temporarily unavailable. Your evidence will be retained for retry.",
          response.status,
          response.status !== 401 && response.status !== 403,
          "infrastructure",
        );
      }
    } else {
      data = await response.json();
    }
  } catch (error: any) {
    if (error instanceof SecurityGatewayError) throw error;
    throw new SecurityGatewayError(
      error?.name === "AbortError"
        ? "Local evidence and AI analysis timed out after 300 seconds"
        : "Verification service unavailable. Your recording has been saved and can be retried.",
      0,
      true,
      "infrastructure",
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  const pipeline = normalizePipeline(data.security_pipeline);
  if (data.status === "REJECTED_FRAUD" || data.status === "FRAUD_DETECTED" || data.legacy_status === "FRAUD_DETECTED") {
    const rejectionReason = "Verification Failed: Evidence video did not pass security verification guidelines. Please record a new video.";
    const fraudAnalysis = computeFraudScore([]);
    const result: HFAnalysisResult = {
      annotated_image: "",
      detection_frames: [],
      detections: [],
      summary: rejectionReason,
      costBreakdown: estimateRepairCost([], { damageContext }),
      estimatedCost: 0,
      fraudAnalysis: { ...fraudAnalysis, totalScore: 100, riskLevel: "high" },
      fraudScore: 100,
      damageAreas: [],
      isAiGenerated: false,
      damageContext,
      isRejected: true,
      rejectionReason,
      fiveStageSecurity: pipeline,
      modelReasoning: [
        rejectionReason,
        "5-layer forensic verification flagged evidence authenticity.",
      ],
      outcome: "FORENSIC_REJECTION",
    };
    persistResult(claimId, result);
    await offlineStorage.completeUpload(claimId);
    toast.error("Evidence verification failed");
    return result;
  }

  const ai = data.ai_result || {};
  const detections: DetectionItem[] = Array.isArray(ai.detections) ? ai.detections : [];
  const detectionFrames: DetectionFrame[] = Array.isArray(ai.detection_frames)
    ? ai.detection_frames
    : [];
  const screenRecordingCheck: ScreenRecordingCheck = {
    flagged: Boolean(ai.screen_recording_check?.flagged),
    confidence: Math.max(0, Math.min(1, Number(ai.screen_recording_check?.confidence) || 0)),
    evidence: Array.isArray(ai.screen_recording_check?.evidence)
      ? ai.screen_recording_check.evidence.map(String).slice(0, 4)
      : [],
    source: String(ai.screen_recording_check?.source || "not_assessed"),
  };
  const costBreakdown = estimateRepairCost(detections, { damageContext });
  const fraudAnalysis = computeFraudScore(detections);
  const sourceWidth = Math.max(1, Number(ai.source_dimensions?.width) || 1280);
  const sourceHeight = Math.max(1, Number(ai.source_dimensions?.height) || 720);

  const damageAreas: DamageArea[] = detections.map((detection, index) => {
    const bbox = detection.bbox || [0, 0, 0, 0];
    const matchingFrame = detectionFrames.find((frame) => frame.label === detection.label);
    const costItem = costBreakdown.items.find((item) => item.label === detection.label);
    return {
      id: `DNG-${String(index + 1).padStart(3, "0")}`,
      type: detection.label
        ? detection.label.charAt(0).toUpperCase() + detection.label.slice(1)
        : "Damage Area",
      confidence: Math.round((detection.confidence || 0) * 100),
      severity: severityToScore(detection.severity),
      cost: costItem?.finalPartsCost || 0,
      coordinates: {
        x: Math.max(0, Math.min(100, (Number(bbox[0]) / sourceWidth) * 100)),
        y: Math.max(0, Math.min(100, (Number(bbox[1]) / sourceHeight) * 100)),
        width: Math.max(0, Math.min(100, ((Number(bbox[2]) - Number(bbox[0])) / sourceWidth) * 100)),
        height: Math.max(0, Math.min(100, ((Number(bbox[3]) - Number(bbox[1])) / sourceHeight) * 100)),
      },
      cropImage: matchingFrame?.image,
      severityLabel: detection.severity || "none",
      severityNote: detection.severity_note,
    };
  });

  const isNoDamage = data.status === "NO_DAMAGE";
  const isRejected = data.status === "REJECTED_FRAUD" || data.status === "FRAUD_DETECTED";
  const authenticityFlagged = pipeline.overallStatus === "FLAGGED" || screenRecordingCheck.flagged;
  const receipt = String(data.cryptographic_audit?.receipt || "");
  const result: HFAnalysisResult & { cryptographicLedgerReceipt?: string } = {
    annotated_image: ai.annotated_image || "",
    detection_frames: detectionFrames,
    detections,
    source_frame: ai.source_frame,
    summary: isNoDamage ? "No eligible vehicle damage detected" : ai.summary || "Analysis complete",
    costBreakdown,
    estimatedCost: costBreakdown.totalCost,
    fraudAnalysis,
    fraudScore: fraudAnalysis.totalScore,
    damageAreas,
    isAiGenerated: true,
    damageContext,
    screenRecordingCheck,
    isNoDamage,
    isRejected,
    rejectionReason: isNoDamage ? "No repairable damage was confirmed in the evidence" : undefined,
    modelReasoning: Array.isArray(ai.model_reasoning) ? ai.model_reasoning : [],
    fiveStageSecurity: pipeline,
    cryptographicLedgerReceipt: receipt,
    outcome: isNoDamage ? "NO_DAMAGE_DETECTED" : authenticityFlagged ? "REVIEW_REQUIRED" : "DAMAGE_DETECTED",
  };

  persistResult(claimId, result, authenticityFlagged);
  // Only terminal, successfully persisted responses may remove recoverable evidence.
  await offlineStorage.completeUpload(claimId);
  onStatus?.(authenticityFlagged ? "Analysis complete — manual review required" : "Evidence verification complete");
  toast.success(authenticityFlagged ? "Analysis complete; claim flagged for review" : "Evidence verification complete");
  return result;
}
