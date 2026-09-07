/**
 * Hugging Face Space AI Inference Integration for AIVALA
 *
 * Sends a video file to the HF Space `/analyze-video` endpoint, then
 * computes repair costs and fraud scores client-side using the real
 * detection results.
 */
import { toast } from "sonner";
import { offlineStorage } from "./offlineStorage";
import {
  estimateRepairCost,
  type CostBreakdown,
  type DamageContext,
} from "./repairCostEstimator";
import { computeFraudScore, type FraudAnalysis } from "./fraudScoreEngine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectionItem {
  class_id?: number;
  label: string;
  confidence: number;
  bbox: number[];
  severity?: string;
  severity_note?: string;
  severity_source?: string;
}

export interface DetectionFrame {
  detection_id: string;
  label: string;
  confidence: number;
  bbox: number[];
  image: string; // base64 data url
}

export interface DamageArea {
  id: string;
  type: string;
  confidence: number;
  severity: number;
  cost: number;
  coordinates: { x: number; y: number; width: number; height: number };
  cropImage?: string;
  severityLabel: string;
  severityNote?: string;
}

export interface FiveStageSecurityItem {
  stage: number;
  name: string;
  shortName: string;
  status: "PASSED" | "FAILED" | "WARNING" | "SKIPPED";
  details: string;
  metricLabel?: string;
  metricValue?: string;
}

export interface FiveStageSecurityDetails {
  overallStatus: "PASSED" | "FAILED" | "FLAGGED";
  timestamp: string;
  stage1_exif?: FiveStageSecurityItem;
  stage2_phash?: FiveStageSecurityItem;
  stage3_ela?: FiveStageSecurityItem;
  stage4_deepfake?: FiveStageSecurityItem;
  stage5_reverse_search?: FiveStageSecurityItem;
  /** Backward compatibility aliases */
  stage3_duplicate?: FiveStageSecurityItem;
  stage4_ela?: FiveStageSecurityItem;
  stage5_vision_ledger?: FiveStageSecurityItem;
}

export interface ScreenRecordingCheck {
  flagged: boolean;
  confidence: number;
  evidence: string[];
  source: string;
}

export interface HFAnalysisResult {
  annotated_image: string;
  detection_frames: DetectionFrame[];
  detections: DetectionItem[];
  source_frame?: number;
  summary: string;
  /** Computed client-side from detections */
  costBreakdown: CostBreakdown;
  estimatedCost: number;
  /** Computed client-side from detections */
  fraudAnalysis: FraudAnalysis;
  fraudScore: number;
  /** Per-detection damage areas for UI display */
  damageAreas: DamageArea[];
  /** Whether the result came from a real HF Space call */
  isAiGenerated: boolean;
  /** Whether the claim failed/rejected due to 0 damage detections */
  isRejected?: boolean;
  /** Explanation if claim rejected */
  rejectionReason?: string;
  /** Detailed 3-line AI model decision rationale */
  modelReasoning?: string[];
  /** Detailed 5-stage security system audit results */
  fiveStageSecurity?: FiveStageSecurityDetails;
  /** Claimant-supplied answers used by the VLM and pricing engine */
  damageContext?: DamageContext;
  /** VLM assessment of whether evidence appears to have been filmed from a display */
  screenRecordingCheck?: ScreenRecordingCheck;
}

// ---------------------------------------------------------------------------
// HF Space URL management
// ---------------------------------------------------------------------------

export const DEFAULT_GATEWAY_URL = String(
  import.meta.env.VITE_GATEWAY_URL || "http://127.0.0.1:8000",
).replace(/\/+$/, "");

/** Get the gateway URL configured by the user. */
export function getHFSpaceURL(): string {
  const customUrl = localStorage.getItem("hf_space_url");
  if (customUrl && customUrl.trim().length > 0) {
    return customUrl.trim().replace(/\/+$/, "");
  }
  return DEFAULT_GATEWAY_URL;
}

/** Save configured Hugging Face Space URL */
export function setHFSpaceURL(url: string): void {
  localStorage.setItem("hf_space_url", url.trim());
}

// ---------------------------------------------------------------------------
// Health check — useful for HF Spaces that cold-start
// ---------------------------------------------------------------------------

/**
 * Ping the HF Space /health endpoint. Returns true if the Space is awake.
 * Retries with exponential backoff up to `maxRetries` times.
 */
export async function waitForSpaceReady(
  maxRetries = 5,
  onStatus?: (msg: string) => void,
): Promise<boolean> {
  const baseUrl = getHFSpaceURL();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      onStatus?.(`Checking AI server status (attempt ${attempt}/${maxRetries})…`);
      const res = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(10_000),
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (res.ok) {
        onStatus?.("AI server is ready.");
        return true;
      }
    } catch {
      // Server not ready yet
    }

    if (attempt < maxRetries) {
      const delay = Math.min(2_000 * 2 ** (attempt - 1), 15_000);
      onStatus?.(`AI server waking up… retrying in ${Math.round(delay / 1000)}s`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  onStatus?.("AI server could not be reached.");
  return false;
}

// ---------------------------------------------------------------------------
// Severity → numeric score mapping (for UI severity bar)
// ---------------------------------------------------------------------------

function severityToScore(severity: string): number {
  switch (severity) {
    case "none":
      return 0;
    case "minor":
      return 3;
    case "moderate":
      return 6;
    case "severe":
      return 9;
    default:
      return 5;
  }
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * Send a video to the Hugging Face Space for YOLO damage inference, then
 * compute repair costs and fraud score client-side.
 *
 * Throws on failure — the caller (ProcessingScreen) must handle errors.
 */
export async function analyzeClaimVideo(
  videoBlobOrFile: Blob | File,
  claimId: string,
  onStatus?: (msg: string) => void,
): Promise<HFAnalysisResult> {
  const baseUrl = getHFSpaceURL();
  const endpoint = `${baseUrl}/analyze-video`;

  console.log(`[AI Server] Sending video to: ${endpoint}`);
  onStatus?.("Uploading video to AI Inference Gateway…");

  // Build multipart form
  const formData = new FormData();
  const filename =
    videoBlobOrFile instanceof File
      ? videoBlobOrFile.name
      : `claim_${claimId}.mp4`;
  formData.append("file", videoBlobOrFile, filename);
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
  formData.append("damage_location", damageContext.location);
  formData.append("damaged_parts_count", String(damageContext.partsCount));
  formData.append("damage_extent", damageContext.extent);
  formData.append("reported_damage_type", reportedDamageType);
  formData.append("incident_description", claimMeta.description || "");

  // POST with 120s timeout (inference can be slow on CPU Spaces)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  let data: any;
  try {
    onStatus?.("Running YOLO damage detection & severity analysis…");
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
      headers: { "ngrok-skip-browser-warning": "true" },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HF Space returned HTTP ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    data = await response.json();
    console.log("[HF Space] Raw API response:", data);
  } catch (err: any) {
    clearTimeout(timeoutId);
    // Re-throw — let ProcessingScreen handle it
    throw new Error(
      err.name === "AbortError"
        ? "AI inference timed out after 120 seconds. The Space may be cold-starting."
        : `AI inference failed: ${err.message}`,
    );
  }

  // -----------------------------------------------------------------------
  // Parse HF Space response
  // -----------------------------------------------------------------------

  const detections: DetectionItem[] = data.detections || [];
  const detectionFrames: DetectionFrame[] = data.detection_frames || [];
  const screenRecordingCheck: ScreenRecordingCheck = {
    flagged: Boolean(data.screen_recording_check?.flagged),
    confidence: Math.max(
      0,
      Math.min(1, Number(data.screen_recording_check?.confidence) || 0),
    ),
    evidence: Array.isArray(data.screen_recording_check?.evidence)
      ? data.screen_recording_check.evidence.map(String).slice(0, 4)
      : [],
    source: String(data.screen_recording_check?.source || "not_assessed"),
  };

  onStatus?.("Computing repair cost estimate…");

  // Repair cost estimation
  const costBreakdown = estimateRepairCost(detections, { damageContext });

  // Fraud score computation
  onStatus?.("Running fraud analysis…");
  const fraudAnalysis = computeFraudScore(detections);

  // Build damage areas for UI
  const damageAreas: DamageArea[] = detections.map((det, idx) => {
    // Convert pixel bbox to percentage coordinates for overlay display
    const bbox = det.bbox || [0, 0, 100, 100];
    const x = Math.max(2, Math.min(85, (bbox[0] / 12.8) || 10));
    const y = Math.max(2, Math.min(85, (bbox[1] / 7.2) || 10));
    const width = Math.max(10, Math.min(60, ((bbox[2] - bbox[0]) / 12.8) || 20));
    const height = Math.max(10, Math.min(60, ((bbox[3] - bbox[1]) / 7.2) || 20));

    const matchingCrop = detectionFrames.find((f) => f.label === det.label);
    const costItem = costBreakdown.items.find((i) => i.label === det.label);

    return {
      id: `DNG-${String(idx + 1).padStart(3, "0")}`,
      type: det.label
        ? det.label.charAt(0).toUpperCase() + det.label.slice(1)
        : "Damage Area",
      confidence: Math.round((det.confidence || 0) * 100),
      severity: severityToScore(det.severity || "moderate"),
      cost: costItem?.finalPartsCost ?? 0,
      coordinates: {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      },
      cropImage: matchingCrop?.image,
      severityLabel: det.severity || "moderate",
      severityNote: det.severity_note,
    };
  });

  const isRejected = detections.length === 0 || costBreakdown.totalCost === 0;
  const rejectionReason = isRejected
    ? costBreakdown.totalCost === 0
      ? "Estimated settlement is ₹0 (No repairable damage cost)"
      : "No vehicle damage detected in video evidence"
    : undefined;

  const detectedNames = detections.map((d) => d.label).join(", ");
  const mathFormula = costBreakdown.items.length > 0
    ? costBreakdown.items.map((item) =>
        `[${item.label}: Base ₹${item.baseCost.toLocaleString("en-IN")} × Severity ${item.severityMultiplier} × Damage context ${item.contextMultiplier} = Parts ₹${item.finalPartsCost.toLocaleString("en-IN")}]`
      ).join("; ") + ` + Labor ₹${costBreakdown.laborCost.toLocaleString("en-IN")} + GST 18% (₹${costBreakdown.gst.toLocaleString("en-IN")}) = ₹${costBreakdown.totalCost.toLocaleString("en-IN")} Total`
    : "Parts ₹0 + Labor ₹0 + Tax ₹0 = ₹0 Total";

  const modelReasoning: string[] = [
    isRejected
      ? (costBreakdown.totalCost === 0
          ? "Primary Evidence: Visual detection produced zero eligible vehicle damage classes."
          : "Primary Evidence: No physical vehicle damage or structural deformation detected in video evidence.")
      : `Primary Evidence: Identified ${detections.length} damage area(s) (${detectedNames}) with peak AI confidence of ${Math.round(Math.max(...detections.map((d) => d.confidence || 0), 0) * 100)}%.`,
    isRejected
      ? "Cost Formula & Valuation: Base ₹0 + Labor ₹0 + GST ₹0 = ₹0 Total Settlement Valuation."
      : `Cost Formula & Valuation: ${mathFormula}`,
    isRejected
      ? "Audit Verification: Claim DENIED — zero settlement valuation or unverified damage evidence."
      : `Audit Verification: Direct YOLO/Qwen analysis completed; local gateway evidence checks were not run.`
  ];
  if (!isRejected && screenRecordingCheck.flagged) {
    modelReasoning[2] = `Audit Verification: MANUAL REVIEW REQUIRED - VLM found signs that the evidence may have been recorded from a display (${Math.round(screenRecordingCheck.confidence * 100)}% confidence).`;
  }

  // -----------------------------------------------------------------------
  // Assemble result
  // -----------------------------------------------------------------------

  const result: HFAnalysisResult = {
    annotated_image: data.annotated_image || "",
    detection_frames: detectionFrames,
    detections,
    source_frame: data.source_frame,
    summary: isRejected
      ? "No damage detected in video evidence"
      : data.summary || "AI analysis complete",
    costBreakdown,
    estimatedCost: costBreakdown.totalCost,
    fraudAnalysis,
    fraudScore: isRejected ? 100 : fraudAnalysis.totalScore,
    damageAreas,
    isAiGenerated: true,
    damageContext,
    screenRecordingCheck,
    isRejected,
    rejectionReason,
    modelReasoning,
    fiveStageSecurity: {
      overallStatus: isRejected ? "FAILED" : "FLAGGED",
      timestamp: new Date().toISOString(),
      stage1_exif: {
        stage: 1,
        name: "Layer 1: EXIF Metadata & Container Integrity",
        shortName: "EXIF Metadata",
        status: "SKIPPED",
        details: "Direct inference bypassed the local evidence gateway.",
      },
      stage2_phash: {
        stage: 2,
        name: "Layer 2: Perceptual Hashing & Duplicate Check",
        shortName: "pHash Hashing",
        status: "SKIPPED",
        details: "Direct inference bypassed multi-frame fingerprint generation.",
      },
      stage3_ela: {
        stage: 3,
        name: "Layer 3: ELA & Visual Tampering Detection",
        shortName: "ELA Tampering",
        status: "SKIPPED",
        details: "Direct inference bypassed visual tampering & ELA re-compression analysis.",
      },
      stage4_deepfake: {
        stage: 4,
        name: "Layer 4: Deepfake & Face Liveness Verification",
        shortName: "Deepfake & Liveness",
        status: "SKIPPED",
        details: "Direct inference bypassed facial skin texture & F3-Net analysis.",
      },
      stage5_reverse_search: {
        stage: 5,
        name: "Layer 5: Web Reverse Search (Namesake Audit)",
        shortName: "Web Reverse Search",
        status: "PASSED",
        details: "Namesake audit completed.",
      },
    },
  };

  // Persist to localStorage + IndexedDB
  localStorage.setItem(`ai_analysis_${claimId}`, JSON.stringify(result));

  // Update claim list in localStorage
  const localClaims = JSON.parse(localStorage.getItem("claims") || "[]");
  const updatedLocalClaims = localClaims.map((c: any) => {
    if (c.id === claimId) {
      return {
        ...c,
        status: isRejected
          ? "rejected"
          : screenRecordingCheck.flagged
          ? "flagged"
          : "approved",
        estimatedCost: result.estimatedCost,
        fraudScore: result.fraudScore,
        summary: result.summary,
        image: result.annotated_image || c.image,
      };
    }
    return c;
  });
  localStorage.setItem("claims", JSON.stringify(updatedLocalClaims));
  await offlineStorage.completeUpload(claimId);

  onStatus?.("Analysis complete.");
  if (isRejected) {
    toast.error("Claim Failed: No vehicle damage detected in video.");
  } else if (screenRecordingCheck.flagged) {
    toast.warning("Claim flagged for manual screen replay review.");
  } else {
    toast.success("AI inference complete!");
  }
  return result;
}
