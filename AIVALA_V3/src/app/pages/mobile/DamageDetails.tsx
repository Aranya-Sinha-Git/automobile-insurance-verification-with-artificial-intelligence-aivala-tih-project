import { useNavigate, useParams } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { ArrowLeft, Car, XCircle } from "lucide-react";
import type { HFAnalysisResult } from "@/app/utils/huggingFaceService";
import FiveStageSecurityCard from "@/app/components/security/FiveStageSecurityCard";
import { parseStoredAnalysis, readStoredAnalysis } from "@/app/utils/securityBackendService";

export default function DamageDetails() {
  const { claimId } = useParams();
  const navigate = useNavigate();

  // Read AI analysis — no mock data fallback
  const storedAnalysis = readStoredAnalysis(claimId);
  const aiData: HFAnalysisResult | null = parseStoredAnalysis(storedAnalysis);

  const damageAreas = aiData?.damageAreas || [];
  const annotatedImage = aiData?.annotated_image;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b p-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/app/results/${claimId}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl">Damage Analysis</h1>
          <p className="text-sm text-gray-500">
            {aiData?.isAiGenerated
              ? "AI Vision & Severity Engine"
              : "AI-detected damage areas"}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* 5-Stage Security Verification Header */}
        {aiData && (
          <FiveStageSecurityCard
            securityDetails={aiData.fiveStageSecurity}
            compact={true}
            defaultExpanded={false}
          />
        )}
        {/* No AI data state */}
        {!aiData && (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 text-center">
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <h3 className="font-medium mb-2">No Analysis Available</h3>
              <p className="text-sm text-gray-600 mb-4">
                No AI analysis results found for this claim. Please submit a
                video for analysis first.
              </p>
              <Button onClick={() => navigate("/app/new-claim")}>
                Start New Claim
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Annotated image or fallback vehicle icon */}
        {aiData && (
          <Card>
            <CardContent className="p-4">
              <div className="relative w-full h-64 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden">
                {annotatedImage ? (
                  <img
                    src={annotatedImage}
                    alt="AI YOLO Annotated Frame"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <>
                    <Car className="h-32 w-32 text-gray-600" />
                    {damageAreas.map((area) => (
                      <div
                        key={area.id}
                        className="absolute border-4 border-red-500 rounded"
                        style={{
                          left: `${area.coordinates.x}%`,
                          top: `${area.coordinates.y}%`,
                          width: `${area.coordinates.width}%`,
                          height: `${area.coordinates.height}%`,
                        }}
                      >
                        <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded">
                          {area.id}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {annotatedImage
                  ? "Frame extracted & bounding boxes annotated by AI Vision Model"
                  : damageAreas.length > 0
                    ? "AI Highlighted Damage Areas"
                    : "No damage areas detected"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Damage area cards */}
        {damageAreas.length === 0 && aiData && (
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              No specific damage areas were detected by the AI model.
            </CardContent>
          </Card>
        )}

        {damageAreas.map((area) => (
          <Card key={area.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive">{area.id}</Badge>
                    <h3 className="font-medium">{area.type}</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Confidence: {area.confidence}%
                  </p>
                  {area.severityNote && (
                    <p className="text-xs text-gray-400 mt-1">
                      {area.severityNote}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    ₹{area.cost.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Est. parts cost</p>
                  <p className="text-xs text-gray-400 capitalize mt-1">
                    {area.severityLabel}
                  </p>
                </div>
              </div>

              {area.cropImage && (
                <div className="mb-3 rounded-lg overflow-hidden border border-gray-200 h-28 bg-black">
                  <img
                    src={area.cropImage}
                    alt={area.type}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Severity</span>
                    <span>{area.severity}/10</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        area.severity > 7
                          ? "bg-red-500"
                          : area.severity > 4
                            ? "bg-yellow-500"
                            : "bg-green-500"
                      }`}
                      style={{ width: `${area.severity * 10}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Itemized 3-Line Decision Rationale */}
              <div className="mt-3 p-3 bg-slate-900 text-white rounded-lg space-y-1.5 text-xs font-sans">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">Line 1:</span>
                  <span><strong>Visual Target:</strong> {area.type} detected at {area.confidence}% confidence.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">Line 2:</span>
                  <span><strong>Severity Rating:</strong> {area.severityLabel.toUpperCase()} — {area.severityNote || "Evaluated by Vision VLM."}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold">Line 3:</span>
                  <span><strong>Cost Valuation:</strong> Base replacement/repair value ₹{area.cost.toLocaleString("en-IN")}.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
