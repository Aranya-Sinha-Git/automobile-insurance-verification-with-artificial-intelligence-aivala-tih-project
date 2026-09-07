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

export class SecurityGatewayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly category: "invalid_evidence" | "infrastructure",
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

function normalizePipeline(raw: any): FiveStageSecurityDetails {
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

function persistResult(claimId: string, result: HFAnalysisResult, flagged = false): void {
  localStorage.setItem(`ai_analysis_${claimId}`, JSON.stringify(result));
  const claims = JSON.parse(localStorage.getItem("claims") || "[]");
  localStorage.setItem(
    "claims",
    JSON.stringify(
      claims.map((claim: any) =>
        claim.id === claimId
          ? {
              ...claim,
              status: result.isRejected ? "rejected" : flagged ? "flagged" : "approved",
              estimatedCost: result.estimatedCost,
              fraudScore: result.fraudScore,
              summary: result.summary,
              image: result.annotated_image || claim.image,
            }
          : claim,
      ),
    ),
  );
}

export async function verifyClaimWithSecurityBackend(
  fileBlobOrFile: Blob | File,
  claimId: string,
  onStatus?: (msg: string) => void,
): Promise<HFAnalysisResult & { cryptographicLedgerReceipt?: string }> {
  const endpoint = `${getSecurityBackendURL()}/verify-claim/`;
  const storedMeta = localStorage.getItem(`claim_meta_${claimId}`);
  const claimMeta = storedMeta ? JSON.parse(storedMeta) : {};
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
    fileBlobOrFile instanceof File ? fileBlobOrFile.name : `claim_${claimId}.mp4`;
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
      headers: { "ngrok-skip-browser-warning": "true" },
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
            "Verification Failed: Evidence video did not pass security verification guidelines. Please record a new video.",
            response.status,
            false,
            "invalid_evidence",
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
    throw new Error(
      error?.name === "AbortError"
        ? "Local evidence and AI analysis timed out after 300 seconds"
        : error?.message || "Local security gateway request failed",
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
        x: Math.max(2, Math.min(85, bbox[0] / 12.8 || 10)),
        y: Math.max(2, Math.min(85, bbox[1] / 7.2 || 10)),
        width: Math.max(10, Math.min(60, (bbox[2] - bbox[0]) / 12.8 || 20)),
        height: Math.max(10, Math.min(60, (bbox[3] - bbox[1]) / 7.2 || 20)),
      },
      cropImage: matchingFrame?.image,
      severityLabel: detection.severity || "none",
      severityNote: detection.severity_note,
    };
  });

  const isRejected = data.status === "NO_DAMAGE";
  const authenticityFlagged = pipeline.overallStatus === "FLAGGED" || screenRecordingCheck.flagged;
  const receipt = String(data.cryptographic_audit?.receipt || "");
  const result: HFAnalysisResult & { cryptographicLedgerReceipt?: string } = {
    annotated_image: ai.annotated_image || "",
    detection_frames: detectionFrames,
    detections,
    source_frame: ai.source_frame,
    summary: isRejected ? "No eligible vehicle damage detected" : ai.summary || "Analysis complete",
    costBreakdown,
    estimatedCost: costBreakdown.totalCost,
    fraudAnalysis,
    fraudScore: isRejected ? 100 : fraudAnalysis.totalScore,
    damageAreas,
    isAiGenerated: true,
    damageContext,
    screenRecordingCheck,
    isRejected,
    rejectionReason: isRejected ? "No repairable damage was confirmed in the evidence" : undefined,
    modelReasoning: Array.isArray(ai.model_reasoning) ? ai.model_reasoning : [],
    fiveStageSecurity: pipeline,
    cryptographicLedgerReceipt: receipt,
  };

  persistResult(claimId, result, authenticityFlagged);
  // Only terminal, successfully persisted responses may remove recoverable evidence.
  await offlineStorage.completeUpload(claimId);
  onStatus?.(authenticityFlagged ? "Analysis complete — manual review required" : "Evidence verification complete");
  toast.success(authenticityFlagged ? "Analysis complete; claim flagged for review" : "Evidence verification complete");
  return result;
}
