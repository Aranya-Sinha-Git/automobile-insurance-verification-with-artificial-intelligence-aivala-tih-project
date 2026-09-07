# expert_system.py
"""
AIVALA Expert Pricing Rule Engine
Maps processed visual damage labels to localized Mumbai workshop pricing indices
using case-sensitive normalization constraints across 9 specific classes.
"""

MUMBAI_WORKSHOP_CATALOG = {
    "Dent": {"Minor": 1500, "Moderate": 3500, "Severe": 8500},
    "scratch": {"Minor": 500, "Moderate": 1800, "Severe": 4000},
    "Crack": {"Minor": 1200, "Moderate": 3000, "Severe": 7000},
    "Paint chip": {"Minor": 800, "Moderate": 2200, "Severe": 5000},
    "Puncture": {"Minor": 150, "Moderate": 300, "Severe": 800},
    "head light damage": {"Minor": 2000, "Moderate": 5000, "Severe": 12000},
    "Windshield damage": {"Minor": 2500, "Moderate": 7000, "Severe": 16500},
    "Windows": {"Minor": 1800, "Moderate": 4000, "Severe": 9500},
    "Frame damage": {"Minor": 3500, "Moderate": 8000, "Severe": 18500}
}

# Intermediate values are linearly interpolated between the catalog's three
# established repair bands so their costs remain ordered with the severity scale.
INTERMEDIATE_SEVERITY_BANDS = {
    "semi_minor": ("Minor", "Moderate", 0.40),
    "semi_moderate": ("Moderate", "Severe", 0.35),
    "semi_severe": ("Moderate", "Severe", 0.70),
}

def evaluate_monetary_payout(damage_class: str, severity_rank: str) -> int:
    """
    Looks up case-sensitive YOLOv8 prediction labels against 
    regional Mumbai garage cost indices.
    """
    try:
        # Standardize outer spaces while keeping exact internal casing variables intact
        raw_key = str(damage_class).strip()
        
        # Case-insensitive safety lookup to guard against label anomalies
        matched_key = None
        for catalog_key in MUMBAI_WORKSHOP_CATALOG.keys():
            if catalog_key.lower() == raw_key.lower():
                matched_key = catalog_key
                break
                
        if not matched_key:
            return 3000  # Baseline fallback cost if class mapping falls out of scope

        sev_lower = str(severity_rank).lower().strip()
        if sev_lower in ["none", "no damage", "false", "nothing", "unclear"]:
            return 0

        if sev_lower in INTERMEDIATE_SEVERITY_BANDS:
            lower_band, upper_band, position = INTERMEDIATE_SEVERITY_BANDS[sev_lower]
            lower_cost = MUMBAI_WORKSHOP_CATALOG[matched_key].get(lower_band, 0)
            upper_cost = MUMBAI_WORKSHOP_CATALOG[matched_key].get(upper_band, 0)
            final_bill = round(lower_cost + (upper_cost - lower_cost) * position)
        else:
            severity_key = str(severity_rank).capitalize().strip()
            final_bill = MUMBAI_WORKSHOP_CATALOG[matched_key].get(severity_key, 0)
        return final_bill
    except Exception:
        return 3000
