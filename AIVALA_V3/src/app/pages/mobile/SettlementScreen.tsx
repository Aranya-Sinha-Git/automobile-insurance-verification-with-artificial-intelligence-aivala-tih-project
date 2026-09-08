import { useNavigate, useParams } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { Label } from "@/app/components/ui/label";
import { ArrowLeft, Wrench, Banknote, Zap, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { HFAnalysisResult } from "@/app/utils/huggingFaceService";
import { parseStoredAnalysis, readStoredAnalysis } from "@/app/utils/securityBackendService";
import { readAccountJson, writeAccountJson } from "@/app/utils/accountStorage";

export default function SettlementScreen() {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState("repair");

  // Read AI analysis for dynamic cost values
  const storedAnalysis = readStoredAnalysis(claimId);
  const aiData: HFAnalysisResult | null = parseStoredAnalysis(storedAnalysis);
  const isNoDamage = Boolean(aiData?.isNoDamage);
  const isRejected = Boolean(aiData?.isRejected || aiData?.outcome === "FORENSIC_REJECTION");
  const reviewRequired = Boolean(
    aiData?.outcome === "REVIEW_REQUIRED" || aiData?.screenRecordingCheck?.flagged || aiData?.fiveStageSecurity?.overallStatus === "FLAGGED",
  );
  const eligible = Boolean(aiData && !isNoDamage && !isRejected && !reviewRequired && (aiData.estimatedCost || 0) > 0);

  const totalCost = aiData?.estimatedCost || 0;
  const cashPayout = Math.round(totalCost * 0.95);

  const confirmSettlement = () => {
    if (!claimId) return;
    if (!eligible) {
      toast.info("A settlement preference is available only after a completed eligible damage result.");
      navigate("/app/dashboard");
      return;
    }
    try {
      const claims = readAccountJson<any[]>("claims", []);
      writeAccountJson(
        "claims",
          claims.map((claim: any) =>
            claim.id === claimId
              ? {
                  ...claim,
                  settlementMethod: selected,
                  settlementStatus: "confirmed",
                  settlementConfirmedAt: new Date().toISOString(),
                }
              : claim,
          ),
      );
      toast.success("Preferred settlement option saved.");
    } catch {
      toast.error("Unable to save your settlement preference.");
      return;
    }
    navigate("/app/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/app/results/${claimId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl">Settlement Options</h1>
          <p className="text-sm text-gray-500">Choose your preferred method</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <RadioGroup value={selected} onValueChange={setSelected}>
          <Card className={`cursor-pointer ${selected === 'repair' ? 'border-blue-500 border-2' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <RadioGroupItem value="repair" id="repair" className="mt-1" />
                <Label htmlFor="repair" className="flex-1 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <Wrench className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">Preferred repair option</h3>
                      <p className="text-sm text-gray-600 mb-3">Save this preference for follow-up. No garage booking is made here.</p>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="h-4 w-4" />
                          <span>Timeline: 3-5 days</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Zap className="h-4 w-4" />
                          <span>Estimated repair value only</span>
                        </div>
                      </div>

                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Estimated Value:</strong>{" "}
                          {totalCost > 0
                            ? `₹${totalCost.toLocaleString()} (full repair value)`
                            : isNoDamage
                              ? "₹0 (no repairable damage detected)"
                              : "Pending AI analysis"}
                        </p>
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer ${selected === 'cash' ? 'border-blue-500 border-2' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <RadioGroupItem value="cash" id="cash" className="mt-1" />
                <Label htmlFor="cash" className="flex-1 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="bg-green-100 p-3 rounded-lg">
                      <Banknote className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                          <h3 className="font-medium mb-1">Preferred cash option</h3>
                      <p className="text-sm text-gray-600 mb-3">Save a preferred payout option for follow-up.</p>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="h-4 w-4" />
                          <span>Timeline: 1-2 business days</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Zap className="h-4 w-4" />
                          <span>No payment is initiated here</span>
                        </div>
                      </div>

                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-800">
                          <strong>Estimated settlement:</strong>{" "}
                          {cashPayout > 0
                            ? `₹${cashPayout.toLocaleString()} (95% of estimate)`
                            : isNoDamage
                              ? "₹0 (no repairable damage detected)"
                              : "Pending AI analysis"}
                        </p>
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
            </CardContent>
          </Card>
        </RadioGroup>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Example repair options</h3>
            <p className="text-xs text-gray-500 mb-2">Demo information only; no shop is booked.</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span>AutoCare Center, Andheri</span>
                <span className="text-yellow-600">★ 4.8</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Quick Fix Garage, Bandra</span>
                <span className="text-yellow-600">★ 4.6</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 bg-white border-t sticky bottom-0 z-10">
        <Button className="w-full" size="lg" onClick={confirmSettlement} disabled={!eligible}>
          {!aiData ? "Result Required" : isNoDamage ? "No Settlement Available" : isRejected ? "Forensic Rejection" : reviewRequired ? "Review Required" : "Save Preferred Option"}
        </Button>
      </div>
    </div>
  );
}
