/**
 * Dynamic Fraud Score Engine for AIVALA
 *
 * Computes a 0-100 fraud risk score from actual YOLO detection data instead
 * of using hardcoded static values.  The score is composed of 4 layers, each
 * contributing 0-25 points.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectionInput {
  label: string;
  confidence: number;
  bbox: number[];
  severity?: string;
  severity_source?: string;
}

export interface FraudLayer {
  name: string;
  score: number;       // 0-25 contribution to total
  confidence: "high" | "medium" | "low";
  details: string;
}

export interface FraudAnalysis {
  /** Overall fraud risk score (0-100) */
  totalScore: number;
  /** Risk classification */
  riskLevel: "low" | "medium" | "high";
  /** Overall confidence in the fraud assessment */
  overallConfidence: number;
  /** Individual analysis layers */
  layers: FraudLayer[];
}

// ---------------------------------------------------------------------------
// Plausibility matrix – which damage types can co-occur naturally
// ---------------------------------------------------------------------------

const PLAUSIBLE_PAIRS: Set<string> = new Set([
  "dent+scratch",
  "scratch+dent",
  "bumper+headlight",
  "headlight+bumper",
  "bumper+dent",
  "dent+bumper",
  "bumper+scratch",
  "scratch+bumper",
  "hood+dent",
  "dent+hood",
  "windshield+crack",
  "crack+windshield",
  "door+dent",
  "dent+door",
  "door+scratch",
  "scratch+door",
  "fender+dent",
  "dent+fender",
  "fender+scratch",
  "scratch+fender",
  "bumper+crack",
  "crack+bumper",
  "hood+scratch",
  "scratch+hood",
  "tail_light+bumper",
  "bumper+tail_light",
  "mirror+door",
  "door+mirror",
  "frame+dent",
  "dent+frame",
]);

// ---------------------------------------------------------------------------
// Layer 1: Damage Consistency (0-25)
// ---------------------------------------------------------------------------

function scoreDamageConsistency(detections: DetectionInput[]): FraudLayer {
  if (detections.length === 0) {
    return {
      name: "Damage Consistency",
      score: 0,
      confidence: "low",
      details: "No detections to analyse for consistency.",
    };
  }

  if (detections.length === 1) {
    return {
      name: "Damage Consistency",
      score: 2,
      confidence: "high",
      details: "Single damage type detected — consistent with a minor incident.",
    };
  }

  const labels = detections.map((d) => d.label.toLowerCase().trim());
  let implausiblePairs = 0;
  let totalPairs = 0;

  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      totalPairs++;
      const key = `${labels[i]}+${labels[j]}`;
      if (!PLAUSIBLE_PAIRS.has(key)) {
        implausiblePairs++;
      }
    }
  }

  const implausibleRatio = totalPairs > 0 ? implausiblePairs / totalPairs : 0;
  const score = Math.round(implausibleRatio * 25);

  let confidence: "high" | "medium" | "low" = "high";
  if (totalPairs < 2) confidence = "medium";

  const details =
    implausiblePairs === 0
      ? "All detected damage types are consistent with a single incident."
      : `${implausiblePairs} of ${totalPairs} damage combination(s) are unusual for a single incident.`;

  return { name: "Damage Consistency", score, confidence, details };
}

// ---------------------------------------------------------------------------
// Layer 2: Severity-to-Cost Ratio (0-25)
// ---------------------------------------------------------------------------

function scoreSeverityCostRatio(detections: DetectionInput[]): FraudLayer {
  if (detections.length === 0) {
    return {
      name: "Severity vs. Cost Plausibility",
      score: 0,
      confidence: "low",
      details: "No detections to assess severity-cost ratio.",
    };
  }

  const severityWeights: Record<string, number> = {
    none: 0,
    minor: 1,
    moderate: 2,
    severe: 3,
  };

  let severeTotalWithLowConf = 0;

  for (const det of detections) {
    const sevLevel = severityWeights[det.severity || "moderate"] ?? 2;
    // Flag: severe damage but low YOLO confidence → suspicious
    if (sevLevel >= 3 && det.confidence < 0.6) {
      severeTotalWithLowConf++;
    }
  }

  const score = Math.min(25, severeTotalWithLowConf * 12);
  const confidence: "high" | "medium" | "low" =
    severeTotalWithLowConf === 0 ? "high" : "medium";

  const details =
    severeTotalWithLowConf === 0
      ? "Severity levels are proportional to detection confidence."
      : `${severeTotalWithLowConf} detection(s) claim severe damage with low AI confidence — may indicate inflated claim.`;

  return { name: "Severity vs. Cost Plausibility", score, confidence, details };
}

// ---------------------------------------------------------------------------
// Layer 3: Detection Confidence (0-25)
// ---------------------------------------------------------------------------

function scoreDetectionConfidence(detections: DetectionInput[]): FraudLayer {
  if (detections.length === 0) {
    return {
      name: "AI Detection Confidence",
      score: 0,
      confidence: "low",
      details: "No detections to evaluate.",
    };
  }

  const avgConf =
    detections.reduce((s, d) => s + d.confidence, 0) / detections.length;

  // Lower average confidence → higher suspicion
  let score: number;
  if (avgConf >= 0.8) score = 2;
  else if (avgConf >= 0.6) score = 8;
  else if (avgConf >= 0.4) score = 16;
  else score = 22;

  const confidence: "high" | "medium" | "low" =
    avgConf >= 0.6 ? "high" : "medium";

  const details = `Average YOLO detection confidence is ${Math.round(avgConf * 100)}%. ${
    avgConf >= 0.7
      ? "Detections are consistent and reliable."
      : "Low confidence may indicate obscured or staged damage."
  }`;

  return { name: "AI Detection Confidence", score, confidence, details };
}

// ---------------------------------------------------------------------------
// Layer 4: Detection Count Anomaly (0-25)
// ---------------------------------------------------------------------------

function scoreDetectionCount(detections: DetectionInput[]): FraudLayer {
  const count = detections.length;

  let score: number;
  let details: string;

  if (count === 0) {
    score = 0;
    details = "No damage detected; this risk indicator does not make a claim decision.";
  } else if (count <= 3) {
    score = 2;
    details = `${count} damage area(s) detected — consistent with a typical incident.`;
  } else if (count <= 6) {
    score = 8;
    details = `${count} damage areas detected — somewhat high for a single incident.`;
  } else {
    score = 20;
    details = `${count} damage areas detected — unusually high, may indicate pre-existing damage or staged scene.`;
  }

  const confidence: "high" | "medium" | "low" =
    count >= 1 && count <= 5 ? "high" : "medium";

  return { name: "Detection Count Analysis", score, confidence, details };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a dynamic fraud risk score from actual YOLO detection results.
 *
 * @param detections - The `detections` array from the HF Space response.
 * @returns A FraudAnalysis with total score, risk level, and per-layer breakdown.
 */
export function computeFraudScore(detections: DetectionInput[]): FraudAnalysis {
  const layers: FraudLayer[] = [
    scoreDamageConsistency(detections),
    scoreSeverityCostRatio(detections),
    scoreDetectionConfidence(detections),
    scoreDetectionCount(detections),
  ];

  const totalScore = layers.reduce((s, l) => s + l.score, 0);

  let riskLevel: "low" | "medium" | "high";
  if (totalScore <= 25) riskLevel = "low";
  else if (totalScore <= 55) riskLevel = "medium";
  else riskLevel = "high";

  // Overall confidence = weighted average of layer confidences
  const confMap = { high: 1.0, medium: 0.7, low: 0.4 };
  const overallConfidence = Math.round(
    (layers.reduce((s, l) => s + confMap[l.confidence], 0) / layers.length) * 100,
  );

  return { totalScore, riskLevel, overallConfidence, layers };
}
