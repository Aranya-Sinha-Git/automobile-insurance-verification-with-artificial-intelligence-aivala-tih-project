import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { CheckCircle, ArrowLeft, PlayCircle, FileText } from "lucide-react";

export default function ClaimSubmission() {
  const navigate = useNavigate();
  const claimId = "CLM-2024-" + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/claim-details")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl">Review Claim</h1>
      </div>

      <div className="flex-1 p-6 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <PlayCircle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Video Evidence</p>
                <p>45 seconds recorded</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Claim Details</p>
              </div>
            </div>
            <div className="space-y-2 text-sm pl-8">
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span>Jan 24, 2024 10:30 AM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Location:</span>
                <span>Mumbai, MH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vehicle:</span>
                <span>Honda City 2020</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h3 className="mb-2 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              AI Verification Process
            </h3>
            <ul className="text-sm space-y-1 text-gray-700">
              <li>• Damage assessment & vehicle analysis</li>
              <li>• 4-layer fraud detection screening</li>
              <li>• Instant repair cost estimation</li>
              <li>• Automated settlement recommendation</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 bg-white border-t">
        <p className="text-xs text-gray-500 mb-3 text-center">
          By submitting, you confirm all information is accurate
        </p>
        <Button 
          className="w-full" 
          size="lg"
          onClick={() => navigate(`/app/processing/${claimId}`)}
        >
          Submit Claim
        </Button>
      </div>
    </div>
  );
}
