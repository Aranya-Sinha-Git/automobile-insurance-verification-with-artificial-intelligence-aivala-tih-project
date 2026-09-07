/**
 * Repair Cost Estimation Engine for AIVALA
 *
 * Computes repair costs from Hugging Face Space YOLO detections using:
 * - Indian auto repair market-rate base cost table, reduced by 10% (per damage label)
 * - Severity multiplier (none/minor/semi_minor/moderate/semi_moderate/semi_severe/severe)
 * - Claimant-reported damage location, affected-part count, and extent
 * - Labor overhead and GST
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectionInput {
  label: string;
  confidence: number;
  bbox: number[]; // [x1, y1, x2, y2] in pixel coords
  severity?: string; // "none" | "minor" | "semi_minor" | "moderate" | "semi_moderate" | "semi_severe" | "severe"
}

export type DamageExtent = "localized" | "multi-panel" | "frame-level";

export interface DamageContext {
  location: string;
  partsCount: number;
  extent: DamageExtent | string;
  damageTypes?: string[];
  reportedDamageType?: string;
}

export interface RepairEstimateOptions {
  damageContext?: DamageContext;
}

export interface PerDetectionCost {
  label: string;
  severity: string;
  baseCost: number;
  severityMultiplier: number;
  contextMultiplier: number;
  finalPartsCost: number;
  laborCost: number;
}

export interface CostBreakdown {
  /** Per-detection itemised costs */
  items: PerDetectionCost[];
  /** Sum of all per-detection parts costs */
  partsCost: number;
  /** Sum of all per-detection labor costs */
  laborCost: number;
  /** Retained for response compatibility; currently disabled */
  inspectionFee: number;
  /** Subtotal before tax */
  subtotal: number;
  /** GST amount (18%) */
  gst: number;
  /** Grand total */
  totalCost: number;
  /** Combined adjustment from claimant-supplied location, part count, and extent */
  contextMultiplier?: number;
  damageContext?: DamageContext;
}

// ---------------------------------------------------------------------------
// Base cost table – average Indian market rates (₹, 2024-25)
// ---------------------------------------------------------------------------

const PRICE_REDUCTION_FACTOR = 0.9;

const BASE_COST_TABLE: Record<string, number> = {
  dent: 8_000,
  scratch: 3_000,
  crack: 12_000,
  puncture: 6_000,
  headlight: 15_000,
  "head light damage": 15_000,
  "signlight damage": 8_000,
  windshield: 18_000,
  window: 10_000,
  frame: 35_000,
  bumper: 12_000,
  hood: 20_000,
  door: 18_000,
  fender: 14_000,
  tail_light: 8_000,
  taillight: 8_000,
  mirror: 5_000,
  bonnet: 20_000,
  trunk: 16_000,
  panel: 10_000,
  paint: 4_000,
  rust: 6_000,
  glass: 12_000,
};

const DEFAULT_BASE_COST = 10_000;

// ---------------------------------------------------------------------------
// Severity multiplier
// ---------------------------------------------------------------------------

const SEVERITY_MULTIPLIER: Record<string, number> = {
  none: 0.0,
  minor: 0.6,
  semi_minor: 0.8,
  moderate: 1.0,
  semi_moderate: 1.3,
  semi_severe: 1.55,
  severe: 1.8,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up the base repair cost for a damage label.
 * Performs case-insensitive partial matching against the table keys.
 */
function getBaseCost(label: string): number {
  const lower = label.toLowerCase().trim();

  // Exact match first
  if (BASE_COST_TABLE[lower] !== undefined) {
    return Math.round(BASE_COST_TABLE[lower] * PRICE_REDUCTION_FACTOR);
  }

  // Partial / fuzzy match – check if the label *contains* a known key
  for (const [key, cost] of Object.entries(BASE_COST_TABLE)) {
    if (lower.includes(key) || key.includes(lower)) {
      return Math.round(cost * PRICE_REDUCTION_FACTOR);
    }
  }

  return Math.round(DEFAULT_BASE_COST * PRICE_REDUCTION_FACTOR);
}

function damageContextMultiplier(context?: DamageContext): number {
  if (!context) return 1.0;

  const extentMultiplier: Record<string, number> = {
    localized: 1.0,
    "multi-panel": 1.25,
    "frame-level": 1.75,
  };
  const locationMultiplier: Record<string, number> = {
    front: 1.1,
    rear: 1.05,
    "left-side": 1.0,
    "right-side": 1.0,
    roof: 1.15,
    underbody: 1.3,
    multiple: 1.2,
  };
  const partsCount = Math.min(8, Math.max(1, Number(context.partsCount) || 1));
  const partsMultiplier = Math.min(1.5, 1 + (partsCount - 1) * 0.08);
  const combined =
    (extentMultiplier[context.extent] || 1.0) *
    (locationMultiplier[context.location] || 1.0) *
    partsMultiplier;

  return Math.round(combined * 100) / 100;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Estimate the total repair cost for a set of YOLO damage detections.
 *
 * @param detections - Array of detection results from the HF Space API.
 * @param options - Claimant-reported damage context used for valuation.
 */
export function estimateRepairCost(
  detections: DetectionInput[],
  options: RepairEstimateOptions = {},
): CostBreakdown {
  const LABOR_RATE = 0.15; // 15 % of discounted parts cost, min ₹450 per detection
  const GST_RATE = 0.18;
  const MIN_LABOR_PER_ITEM = 500 * PRICE_REDUCTION_FACTOR;
  const contextMultiplier = damageContextMultiplier(options.damageContext);

  const items: PerDetectionCost[] = detections
    .filter((d) => (d.severity || "moderate") !== "none")
    .map((det) => {
      const base = getBaseCost(det.label);
      const sevMul = SEVERITY_MULTIPLIER[det.severity || "moderate"] ?? 1.0;

      const partsCost = Math.round(base * sevMul * contextMultiplier);
      const labor = Math.max(MIN_LABOR_PER_ITEM, Math.round(partsCost * LABOR_RATE));

      return {
        label: det.label,
        severity: det.severity || "moderate",
        baseCost: base,
        severityMultiplier: sevMul,
        contextMultiplier,
        finalPartsCost: partsCost,
        laborCost: labor,
      };
    });

  if (items.length === 0) {
    return {
      items: [],
      partsCost: 0,
      laborCost: 0,
      inspectionFee: 0,
      subtotal: 0,
      gst: 0,
      totalCost: 0,
      contextMultiplier,
      damageContext: options.damageContext,
    };
  }

  const partsCost = items.reduce((s, i) => s + i.finalPartsCost, 0);
  const laborCost = items.reduce((s, i) => s + i.laborCost, 0);
  const subtotal = partsCost + laborCost;
  const gst = Math.round(subtotal * GST_RATE);
  const totalCost = subtotal + gst;

  return {
    items,
    partsCost,
    laborCost,
    inspectionFee: 0,
    subtotal,
    gst,
    totalCost,
    contextMultiplier,
    damageContext: options.damageContext,
  };
}
