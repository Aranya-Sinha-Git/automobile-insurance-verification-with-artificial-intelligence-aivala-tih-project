import { useNavigate, useParams } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import {
  CheckCircle,
  AlertTriangle,
  Eye,
  ArrowRight,
  Home,
  XCircle,
  ShieldAlert,
  Phone,
} from "lucide-react";
import type { HFAnalysisResult } from "@/app/utils/huggingFaceService";
import FiveStageSecurityCard from "@/app/components/security/FiveStageSecurityCard";

export default function ResultsScreen() {
  const { claimId } = useParams();
  const navigate = useNavigate();

  // Read AI analysis from localStorage
  const storedAnalysis = claimId
    ? localStorage.getItem(`ai_analysis_${claimId}`)
    : null;
  const aiData: HFAnalysisResult | null = storedAnalysis
    ? JSON.parse(storedAnalysis)
    : null;

  // If no AI data exists, show an error state
  if (!aiData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <XCircle className="h-16 w-16 text-red-400 mb-4" />
        <h1 className="text-xl mb-2">No Analysis Data</h1>
        <p className="text-gray-500 text-sm text-center mb-6">
          No AI analysis results found for claim {claimId}. Please submit a
          video for analysis first.
        </p>
        <Button onClick={() => navigate("/app/new-claim")}>
          Start New Claim
        </Button>
      </div>
    );
  }

  // All values are derived from the AI analysis — no hardcoded fallbacks
  const isRejected = aiData.isRejected || aiData.detections.length === 0;
  const screenReplayFlag = Boolean(aiData.screenRecordingCheck?.flagged);

  if (isRejected) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-b-3xl">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-12 w-12" />
            <div>
              <h1 className="text-2xl">Claim Rejected</h1>
              <p className="text-white/70 text-sm">ID: {claimId}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col justify-center">
          <Card className="bg-red-50 border-red-300 shadow-sm">
            <CardContent className="p-6 text-center">
              <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-red-900 mb-2">
                We could not approve this claim
              </h2>
              <p className="text-sm text-red-800">
                {aiData.rejectionReason ||
                  "The submitted evidence did not contain enough verified vehicle damage to approve this claim."}
              </p>
              <p className="text-sm text-gray-600 mt-4">
                If you believe this decision is incorrect, please contact customer service for help.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="p-4 bg-white border-t space-y-3">
          <Button asChild className="w-full bg-red-600 hover:bg-red-700">
            <a href="tel:18001234567">
              <Phone className="mr-2 h-4 w-4" />
              Call customer service
            </a>
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/app/dashboard")}
          >
            <Home className="mr-2 h-4 w-4" />
            Go back to homepage
          </Button>
        </div>
      </div>
    );
  }

  const totalCost = isRejected ? 0 : aiData.estimatedCost;
  const summary = aiData.summary;
  const fraudScore = isRejected ? 100 : aiData.fraudScore;
  const fraudAnalysis = aiData.fraudAnalysis;
  const costBreakdown = aiData.costBreakdown;
  const damageContext = aiData.damageContext;

  // Derive risk level and badge
  const riskLevel = String(
    fraudAnalysis?.riskLevel ||
      (fraudScore <= 25 ? "low" : fraudScore <= 55 ? "medium" : "high"),
  ).toLowerCase() as "low" | "medium" | "high";
  const riskBadge = screenReplayFlag
    ? { label: "Manual Review", className: "bg-orange-100 text-orange-700" }
    : isRejected
    ? { label: "Rejected (0 Detections)", className: "bg-red-100 text-red-700" }
    : {
        low: { label: "Low Risk", className: "bg-white text-green-600" },
        medium: { label: "Medium Risk", className: "bg-yellow-100 text-yellow-700" },
        high: { label: "High Risk", className: "bg-red-100 text-red-700" },
      }[riskLevel];

  const headerGradient = screenReplayFlag
    ? "from-orange-500 to-amber-600"
    : isRejected
    ? "from-red-600 to-red-700"
    : {
        low: "from-green-500 to-green-600",
        medium: "from-yellow-500 to-orange-500",
        high: "from-red-500 to-red-600",
      }[riskLevel];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div
        className={`bg-gradient-to-r ${headerGradient} text-white p-6 rounded-b-3xl`}
      >
        <div className="flex items-center gap-3 mb-4">
          {isRejected || screenReplayFlag || riskLevel === "high" ? (
            <ShieldAlert className="h-12 w-12" />
          ) : (
            <CheckCircle className="h-12 w-12" />
          )}
          <div>
            <h1 className="text-2xl">
              {isRejected ? "Claim Rejected / Failed" : screenReplayFlag || riskLevel === "high" ? "Claim Flagged" : "Claim Approved!"}
            </h1>
            <p className="text-white/70 text-sm">ID: {claimId}</p>
          </div>
        </div>

        <Card className="bg-white/10 border-white/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white/70 text-sm">Estimated Settlement</p>
                <p className="text-3xl">₹{totalCost.toLocaleString()}</p>
              </div>
              <Badge className={riskBadge.className}>{riskBadge.label}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 space-y-4">
        {screenReplayFlag && (
          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-orange-900">Possible screen replay detected</h3>
                  <p className="text-sm text-orange-800 mt-1">
                    The VLM found signs that this evidence may have been filmed from another display. This claim needs manual review.
                  </p>
                  {aiData.screenRecordingCheck?.evidence?.length ? (
                    <ul className="text-xs text-orange-800 mt-2 space-y-1">
                      {aiData.screenRecordingCheck.evidence.map((item, index) => (
                        <li key={index}>• {item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 5-Stage Security Pipeline System Card */}
        <FiveStageSecurityCard
          securityDetails={aiData.fiveStageSecurity}
          defaultExpanded={false}
        />

        {/* Damage Assessment */}
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2">Damage Assessment</h3>
            <p className="text-sm text-gray-600 mb-3">{summary}</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(`/app/damage/${claimId}`)}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Detailed Analysis
            </Button>
          </CardContent>
        </Card>

        {/* Cost Breakdown — all values from cost estimator */}
        {costBreakdown && (
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3">Cost Breakdown</h3>
              {damageContext && (
                <div className="rounded-lg bg-blue-50/80 border border-blue-100 p-3 mb-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase text-gray-500 font-semibold">Area</p>
                      <p className="text-xs font-medium capitalize text-gray-800">
                        {damageContext.location.replace("-", " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-gray-500 font-semibold">Parts</p>
                      <p className="text-xs font-medium text-gray-800">{damageContext.partsCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-gray-500 font-semibold">Extent</p>
                      <p className="text-xs font-medium capitalize text-gray-800">
                        {damageContext.extent.replace("-", " ")}
                      </p>
                    </div>
                  </div>
                  {(damageContext.damageTypes?.length || damageContext.reportedDamageType) && (
                    <div className="pt-2 mt-2 border-t border-blue-200/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-gray-600 font-medium">Reported Types:</span>
                      <span className="text-[11px] font-semibold text-blue-800 capitalize">
                        {damageContext.damageTypes?.join(", ") || damageContext.reportedDamageType}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2 text-sm">
                {/* Per-item breakdown */}
                {costBreakdown.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-gray-600">
                      {item.label.charAt(0).toUpperCase() + item.label.slice(1)}{" "}
                      <span className="text-xs text-gray-400">
                        ({item.severity})
                      </span>
                    </span>
                    <span>₹{item.finalPartsCost.toLocaleString()}</span>
                  </div>
                ))}

                <div className="border-t pt-2 mt-2" />

                <div className="flex justify-between">
                  <span className="text-gray-600">Parts & Materials</span>
                  <span>₹{costBreakdown.partsCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Labor & Bodywork</span>
                  <span>₹{costBreakdown.laborCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">GST (18%)</span>
                  <span>₹{costBreakdown.gst.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total Estimate</span>
                  <span className="text-blue-600">
                    ₹{costBreakdown.totalCost.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h3 className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
              Next Steps
            </h3>
            <ul className="text-sm space-y-1 text-gray-700">
              <li>✓ AI damage analysis complete</li>
              <li>✓ Fraud risk assessed ({screenReplayFlag ? "manual review" : `${riskLevel} risk`})</li>
              {screenReplayFlag ? (
                <li>• Wait for evidence authenticity review</li>
              ) : (
                <>
                  <li>• Choose settlement option</li>
                  <li>• Schedule repair appointment</li>
                </>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 bg-white border-t sticky bottom-0 z-10">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/app/dashboard")}
          >
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>
          {!screenReplayFlag && (
            <Button
              className="flex-1"
              onClick={() => navigate(`/app/settlement/${claimId}`)}
            >
              Choose Settlement <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
