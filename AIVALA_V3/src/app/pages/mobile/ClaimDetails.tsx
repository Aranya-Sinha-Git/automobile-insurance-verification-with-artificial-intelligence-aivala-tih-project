import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { offlineStorage } from "@/app/utils/offlineStorage";

export interface DamageCategoryOption {
  value: string;
  label: string;
  shortDesc: string;
  icon: string;
}

const damageCategories: DamageCategoryOption[] = [
  { value: "dent", label: "Dent", shortDesc: "Panel dent / depression", icon: "🔨" },
  { value: "scratch", label: "Scratch", shortDesc: "Surface scratch / scrape", icon: "⚡" },
  { value: "paint trace", label: "Paint trace", shortDesc: "Paint scuff / rub mark", icon: "🎨" },
  { value: "head light damage", label: "Headlight", shortDesc: "Front headlight lamp/lens", icon: "💡" },
  { value: "taillight damage", label: "Taillight", shortDesc: "Rear taillight lamp/lens", icon: "🚨" },
  { value: "sidemirror damage", label: "Side mirror", shortDesc: "Side view mirror unit", icon: "🪞" },
  { value: "signlight damage", label: "Signal light", shortDesc: "Indicator / fog light", icon: "✨" },
  { value: "window damage", label: "Window glass", shortDesc: "Side door window pane", icon: "🪟" },
  { value: "windshield damage", label: "Windshield", shortDesc: "Front / rear windshield", icon: "🛡️" },
];

const damageLocations = [
  { value: "front", label: "Front" },
  { value: "rear", label: "Rear" },
  { value: "left-side", label: "Left side" },
  { value: "right-side", label: "Right side" },
  { value: "roof", label: "Roof" },
  { value: "underbody", label: "Underbody" },
  { value: "multiple", label: "Multiple areas" },
];

const damageExtents = [
  { value: "localized", label: "Localized — one small area" },
  { value: "multi-panel", label: "Multi-panel — spread across parts" },
  { value: "frame-level", label: "Frame-level — structural impact" },
];

/**
 * ClaimDetails / Incident Details Screen
 * Allows claimant to review vehicle info and select multiple damage types (e.g. Scratch AND Dent)
 * before triggering AI Vision & 5-Stage Security Analysis.
 */
export default function ClaimDetails() {
  const navigate = useNavigate();
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const now = new Date();
  const defaultDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [formData, setFormData] = useState({
    vehicle: "Honda City 2022, MH-02-AB-1234",
    damageTypes: ["dent", "scratch"] as string[],
    damageLocation: "front",
    damagedPartsCount: 2,
    damageExtent: "localized",
    date: defaultDateTime,
    location: "Mumbai, Maharashtra",
    description: "",
  });

  /**
   * Toggle a damage category in the multi-select list.
   * Ensures at least one type remains or permits toggling with active validation feedback.
   */
  const toggleDamageType = (value: string) => {
    setFormData((prev) => {
      const isSelected = prev.damageTypes.includes(value);
      const nextDamageTypes = isSelected
        ? prev.damageTypes.filter((t) => t !== value)
        : [...prev.damageTypes, value];

      // Auto-update damaged parts count suggestion if default
      const suggestedParts = Math.max(1, nextDamageTypes.length);
      return {
        ...prev,
        damageTypes: nextDamageTypes,
        damagedPartsCount:
          prev.damagedPartsCount === prev.damageTypes.length
            ? suggestedParts
            : prev.damagedPartsCount,
      };
    });
  };

  /**
   * Remove a specific damage type pill
   */
  const removeDamageType = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      damageTypes: prev.damageTypes.filter((t) => t !== value),
    }));
  };

  /**
   * Select all standard exterior damage types
   */
  const selectAllDamageTypes = () => {
    setFormData((prev) => ({
      ...prev,
      damageTypes: damageCategories.map((c) => c.value),
    }));
  };

  /**
   * Reset to single primary damage type
   */
  const resetDamageTypes = () => {
    setFormData((prev) => ({
      ...prev,
      damageTypes: ["dent"],
    }));
  };

  const handleSubmitAnalysis = async () => {
    if (isStartingAnalysis) return;

    if (formData.damageTypes.length === 0) {
      toast.error("Please select at least one damage type (e.g. Dent or Scratch).");
      return;
    }

    if (
      !formData.vehicle.trim() ||
      !formData.date ||
      !formData.location.trim() ||
      formData.damagedPartsCount < 1
    ) {
      toast.error("Please complete all required claim details.");
      return;
    }

    setIsStartingAnalysis(true);
    try {
      const draftId = localStorage.getItem("current_claim_draft_id");
      const draftClaim = draftId
        ? await offlineStorage.getClaimAsync(draftId)
        : null;
      const videoFile: Blob | File | undefined =
        (window as any).currentClaimVideoFile || draftClaim?.videoBlob;
      if (!videoFile) {
        toast.error("Saved evidence was not found. Please record the video again.");
        navigate("/app/video-recording");
        return;
      }

      const claimId = draftId || `CLM-${Date.now()}`;
      const thumbnail =
        (window as any).currentClaimThumbnail ||
        localStorage.getItem("claimCapture") ||
        "";

      const formattedDamageType = formData.damageTypes.join(", ");
      const damageContext = {
        location: formData.damageLocation,
        partsCount: Math.min(12, Math.max(1, Number(formData.damagedPartsCount))),
        extent: formData.damageExtent,
        damageTypes: formData.damageTypes,
        reportedDamageType: formattedDamageType,
      };

      const newClaim = {
        id: claimId,
        type: "auto",
        status: "pending_upload",
        vehicle: formData.vehicle,
        damageType: formattedDamageType,
        damageTypes: formData.damageTypes,
        damageContext,
        date: formData.date.replace("T", " "),
        location: formData.location,
        description: formData.description,
        image: thumbnail,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        videoBlob: videoFile,
        videoFileName:
          videoFile instanceof File ? videoFile.name : draftClaim?.videoFileName,
        videoMimeType: videoFile.type || draftClaim?.videoMimeType,
        claimData: {
          description: formData.description,
          location: formData.location,
          vehicleInfo: formData.vehicle,
          damageType: formattedDamageType,
          damageTypes: formData.damageTypes,
          damageContext,
        },
        size: videoFile.size,
      };

      // The processing screen owns an immediate online submission. Only place
      // the claim in the background queue when the device is actually offline.
      const saved = await offlineStorage.saveClaim(newClaim as any, !navigator.onLine);
      if (!saved) {
        toast.error("Unable to save incident details. Check available storage and try again.");
        return;
      }
      
      const { videoBlob: _videoBlob, ...claimMetadata } = newClaim;
      try {
        const existingClaims = JSON.parse(localStorage.getItem("claims") || "[]");
        const deduplicatedClaims = existingClaims.filter(
          (claim: any) => claim.id !== claimId,
        );
        deduplicatedClaims.unshift(claimMetadata);
        if (deduplicatedClaims.length > 20) deduplicatedClaims.length = 20;
        localStorage.setItem("claims", JSON.stringify(deduplicatedClaims));
      } catch (quotaErr) {
        console.warn("LocalStorage claims list full, continuing:", quotaErr);
      }

      try {
        localStorage.setItem(`claim_meta_${claimId}`, JSON.stringify(claimMetadata));
      } catch (metaErr) {
        console.warn("LocalStorage claim_meta full, continuing:", metaErr);
      }

      try {
        localStorage.removeItem("current_claim_draft_id");
        localStorage.removeItem("pending_claim_draft");
      } catch {
        // Safe ignore
      }

      if (!navigator.onLine) {
        toast.success("Claim saved offline. It will submit when service returns.");
        navigate("/app/dashboard");
        return;
      }

      toast.success("Incident details saved. Starting AI analysis.");
      navigate(`/app/processing/${claimId}`);
    } catch (error) {
      console.error("Unable to start claim analysis:", error);
      toast.error("Unable to start AI analysis. Your evidence is still saved; please try again.");
    } finally {
      setIsStartingAnalysis(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Top Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-20 shadow-xs">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to video recording"
          onClick={() => navigate("/app/video-recording")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900">Incident Details</h1>
          <p className="text-xs text-gray-500">Evidence recorded · Provide incident & damage types</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Vehicle and Incident Info Card */}
        <Card className="border-gray-200/80 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="vehicle" className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                <Car className="h-4 w-4 text-blue-600" />
                Vehicle & Registration
              </Label>
              <Input
                id="vehicle"
                value={formData.vehicle}
                className="bg-white text-sm"
                onChange={(event) =>
                  setFormData({ ...formData, vehicle: event.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="incident-date" className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Date & Time
                </Label>
                <Input
                  id="incident-date"
                  type="datetime-local"
                  value={formData.date}
                  className="min-w-0 w-full bg-white text-xs"
                  onChange={(event) =>
                    setFormData({ ...formData, date: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label htmlFor="incident-location" className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <MapPin className="h-4 w-4 text-red-600" />
                  Incident City / Area
                </Label>
                <Input
                  id="incident-location"
                  value={formData.location}
                  className="min-w-0 w-full bg-white text-xs"
                  onChange={(event) =>
                    setFormData({ ...formData, location: event.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Damage Types Multi-Selection Card */}
        <Card className="border-blue-200/90 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-1.5 rounded-md">
                  <ShieldAlert className="h-4 w-4 text-blue-700" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm text-gray-900">Types of Damage</h2>
                  <p className="text-[11px] text-gray-500">Select all that apply (e.g. Scratch & Dent)</p>
                </div>
              </div>
              <Badge
                variant={formData.damageTypes.length > 0 ? "default" : "destructive"}
                className={`text-xs px-2 py-0.5 font-medium ${
                  formData.damageTypes.length > 0
                    ? "bg-blue-600 text-white"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                }`}
              >
                {formData.damageTypes.length === 0
                  ? "None selected"
                  : `${formData.damageTypes.length} selected`}
              </Badge>
            </div>

            {/* Quick Actions Header Bar */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-1 pb-0.5 border-t border-gray-100">
              <span className="text-[11px] font-medium text-gray-600">Damage categories:</span>
              <div className="flex items-center gap-2">
                {formData.damageTypes.length < damageCategories.length ? (
                  <button
                    type="button"
                    onClick={selectAllDamageTypes}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
                  >
                    Select all
                  </button>
                ) : null}
                {formData.damageTypes.length > 0 && (
                  <button
                    type="button"
                    onClick={resetDamageTypes}
                    className="text-[11px] text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Multi-Select Chip Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {damageCategories.map((category) => {
                const isSelected = formData.damageTypes.includes(category.value);
                return (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => toggleDamageType(category.value)}
                    aria-pressed={isSelected}
                    className={`relative p-2.5 rounded-lg text-left transition-all duration-150 flex flex-col justify-between border cursor-pointer select-none group ${
                      isSelected
                        ? "bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                        : "bg-gray-50/60 border-gray-200/80 hover:bg-gray-100/70 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 w-full">
                      <span className="text-base" role="img" aria-label={category.label}>
                        {category.icon}
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 group-hover:border-gray-400 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold leading-tight ${
                          isSelected ? "text-blue-900 font-bold" : "text-gray-800"
                        }`}
                      >
                        {category.label}
                      </p>
                      <p className="text-[10px] text-gray-500 leading-tight mt-0.5 line-clamp-1">
                        {category.shortDesc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected damage badges summary list */}
            {formData.damageTypes.length > 0 ? (
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-gray-600">
                  <span className="font-semibold text-gray-700 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-blue-600" />
                    Selected for AI Analysis:
                  </span>
                  <span className="text-gray-500">{formData.damageTypes.length} type(s)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {formData.damageTypes.map((typeVal) => {
                    const cat = damageCategories.find((c) => c.value === typeVal);
                    const label = cat ? `${cat.icon} ${cat.label}` : typeVal;
                    return (
                      <span
                        key={typeVal}
                        className="inline-flex items-center gap-1 bg-white border border-blue-200 text-blue-900 text-xs font-medium px-2 py-0.5 rounded-full shadow-2xs"
                      >
                        {label}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDamageType(typeVal);
                          }}
                          className="text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full p-0.5 cursor-pointer"
                          aria-label={`Remove ${label}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Please select at least one damage type to proceed with AI analysis.</span>
              </div>
            )}

            {/* Parts Count and Extent Fields */}
            <div className="grid grid-cols-[1fr_6.5rem] gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="damage-location" className="text-xs font-semibold text-gray-700">
                  Damage Location
                </Label>
                <select
                  id="damage-location"
                  className="w-full h-10 px-3 border border-gray-300 rounded-md text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.damageLocation}
                  onChange={(event) =>
                    setFormData({ ...formData, damageLocation: event.target.value })
                  }
                >
                  {damageLocations.map((location) => (
                    <option key={location.value} value={location.value}>
                      {location.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="parts-count" className="text-xs font-semibold text-gray-700">
                  Parts Count
                </Label>
                <Input
                  id="parts-count"
                  type="number"
                  min={1}
                  max={12}
                  inputMode="numeric"
                  value={formData.damagedPartsCount}
                  className="h-10 bg-white text-xs text-center"
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      damagedPartsCount: Number(event.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="damage-extent" className="text-xs font-semibold text-gray-700">
                Extent of Impact
              </Label>
              <select
                id="damage-extent"
                className="w-full h-10 px-3 border border-gray-300 rounded-md text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.damageExtent}
                onChange={(event) =>
                  setFormData({ ...formData, damageExtent: event.target.value })
                }
              >
                {damageExtents.map((extent) => (
                  <option key={extent.value} value={extent.value}>
                    {extent.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-semibold text-gray-700">
                Claimant Notes (Optional)
              </Label>
              <Textarea
                id="description"
                rows={2}
                placeholder="E.g., side collision scrape along front fender and scratch on passenger door"
                value={formData.description}
                className="text-xs bg-white resize-none"
                onChange={(event) =>
                  setFormData({ ...formData, description: event.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="p-3 bg-white border-t fixed bottom-0 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md z-30 shadow-lg">
        <Button
          type="button"
          className="w-full bg-blue-600 hover:bg-blue-700 h-12 font-semibold text-sm shadow-md cursor-pointer disabled:opacity-50"
          onClick={handleSubmitAnalysis}
          disabled={isStartingAnalysis || formData.damageTypes.length === 0}
        >
          {isStartingAnalysis ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Incident Details...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Start AI Analysis ({formData.damageTypes.length} damage{" "}
              {formData.damageTypes.length === 1 ? "type" : "types"})
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
