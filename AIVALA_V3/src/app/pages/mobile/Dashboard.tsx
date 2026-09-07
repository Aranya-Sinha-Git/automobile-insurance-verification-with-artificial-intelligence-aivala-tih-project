import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
} from "@/app/components/ui/card";

import { Badge } from "@/app/components/ui/badge";
import { OfflineSync } from "@/app/components/OfflineSync";

import {
  PlusCircle,
  FileText,
  User,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

export default function Dashboard() {

  const navigate = useNavigate();

  // ✅ GET USER
  const user =
    JSON.parse(localStorage.getItem("user") || "{}");

  // ✅ GET CLAIMS
  const [recentClaims, setRecentClaims] = useState<any[]>(() =>
    JSON.parse(localStorage.getItem("claims") || "[]"),
  );
  const [pendingDraft, setPendingDraft] = useState<any>(() =>
    JSON.parse(localStorage.getItem("pending_claim_draft") || "null"),
  );

  useEffect(() => {
    const refreshClaims = () => {
      setRecentClaims(JSON.parse(localStorage.getItem("claims") || "[]"));
      setPendingDraft(
        JSON.parse(localStorage.getItem("pending_claim_draft") || "null"),
      );
    };
    window.addEventListener("aivala-offline-storage-changed", refreshClaims);
    window.addEventListener("storage", refreshClaims);
    return () => {
      window.removeEventListener("aivala-offline-storage-changed", refreshClaims);
      window.removeEventListener("storage", refreshClaims);
    };
  }, []);

  // counts
  const pendingCount =
    recentClaims.filter(
      (c: any) =>
        c.status === "processing" || c.status === "pending_upload"
    ).length;

  const approvedCount =
    recentClaims.filter(
      (c: any) =>
        c.status === "approved"
    ).length;

  const rejectedCount =
    recentClaims.filter(
      (c: any) =>
        c.status === "rejected"
    ).length;

  const openClaim = (claim: any) => {
    const destination =
      claim.status === "processing" ||
      claim.status === "pending" ||
      claim.status === "pending_upload"
        ? `/app/processing/${claim.id}`
        : `/app/results/${claim.id}`;

    navigate(destination);
  };

  const statusClassName = (status: string) => {
    if (status === "approved") return "bg-green-500";
    if (status === "rejected") return "bg-red-500";
    if (status === "flagged") return "bg-orange-500";
    return "bg-yellow-500";
  };

  return (

    <div className="min-h-screen bg-gray-50 pb-20">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-b-3xl">

        <div className="flex justify-between items-center mb-6">

          <div>

            <h1 className="text-2xl mb-1">
              Welcome,
              {" "}
              {user?.name || "User"}
            </h1>

            <p className="text-blue-100">
              {user?.provider || "Insurance"}
            </p>

          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-white"
            onClick={() =>
              navigate("/app/settings")
            }
          >

            <Settings className="h-6 w-6" />

          </Button>

        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-3">

          <Card className="bg-white/10 border-white/20">

            <CardContent className="p-4 text-center">

              <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-300" />

              <div className="text-2xl">
                {pendingCount}
              </div>

              <div className="text-xs text-blue-100">
                Pending
              </div>

            </CardContent>

          </Card>

          <Card className="bg-white/10 border-white/20">

            <CardContent className="p-4 text-center">

              <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-300" />

              <div className="text-2xl">
                {approvedCount}
              </div>

              <div className="text-xs text-blue-100">
                Approved
              </div>

            </CardContent>

          </Card>

          <Card className="bg-white/10 border-white/20">

            <CardContent className="p-4 text-center">

              <XCircle className="h-5 w-5 mx-auto mb-1 text-red-300" />

              <div className="text-2xl">
                {rejectedCount}
              </div>

              <div className="text-xs text-blue-100">
                Rejected
              </div>

            </CardContent>

          </Card>

        </div>

      </div>

      {/* CONTENT */}
      <div className="p-6 space-y-4">

        {/* NEW CLAIM */}
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0 shadow-lg">

          <CardContent className="p-6">

            <h3 className="text-xl mb-2">
              New Insurance Claim
            </h3>

            <p className="text-green-100 mb-4 text-sm">
              Quick AI-powered verification
            </p>

            <Button
              className="w-full bg-white text-green-600 hover:bg-green-50"
              onClick={() =>
                navigate("/app/new-claim")
              }
            >

              <PlusCircle className="mr-2 h-5 w-5" />

              Start New Claim

            </Button>

          </CardContent>

        </Card>

        {pendingDraft && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-amber-900">Evidence saved</p>
                <p className="text-xs text-amber-700">Finish this offline claim when ready.</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  localStorage.setItem("current_claim_draft_id", pendingDraft.id);
                  navigate("/app/claim-details");
                }}
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        <OfflineSync />

        {/* RECENT CLAIMS */}
        <div className="mt-6">

          <div className="flex justify-between items-center mb-4">

            <h2 className="text-lg">
              Recent Claims
            </h2>

          </div>

          <div className="space-y-4">

            {recentClaims.length === 0 ? (

              <Card className="p-6 text-center">

                <p className="text-gray-500">
                  No claims submitted yet
                </p>

              </Card>

            ) : (

              recentClaims.map(
                (claim: any) => (

                  <Card
                    key={claim.id}
                    role="button"
                    tabIndex={0}
                    className="overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    onClick={() => openClaim(claim)}
                    aria-label={`Open claim ${claim.id}`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openClaim(claim);
                      }
                    }}
                  >

                    {/* IMAGE */}
                    {claim.image && (

                      <img
                        src={claim.image}
                        alt="Claim"
                        className="w-full h-48 object-cover"
                      />

                    )}

                    <CardContent className="p-4">

                      <div className="flex justify-between items-start">

                        <div className="flex items-start gap-3">

                          <div className="bg-blue-100 p-2 rounded-lg">

                            <FileText className="h-5 w-5 text-blue-600" />

                          </div>

                          <div>

                            <div className="font-medium">
                              {claim.id}
                            </div>

                            <div className="text-sm text-gray-500">
                              {claim.type} Insurance
                            </div>

                            <div className="text-xs text-gray-400 mt-1">
                              {claim.date}
                            </div>

                          </div>

                        </div>

                        <Badge className={statusClassName(claim.status)}>

                          {String(claim.status).replaceAll("_", " ")}

                        </Badge>

                      </div>

                    </CardContent>

                  </Card>

                )
              )

            )}

          </div>

        </div>

      </div>

      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 bg-white border-t shadow-lg w-full sm:max-w-md z-30">

        <div className="grid grid-cols-4 p-2">

          <Button
            variant="ghost"
            className="flex-col h-auto py-2 text-blue-600"
            onClick={() => navigate("/app/dashboard")}
          >

            <FileText className="h-5 w-5 mb-1" />

            <span className="text-xs font-medium">
              Claims
            </span>

          </Button>

          <Button
            variant="ghost"
            className="flex-col h-auto py-2"
            onClick={() => navigate("/app/history")}
          >

            <Clock className="h-5 w-5 mb-1" />

            <span className="text-xs">
              History
            </span>

          </Button>

          <Button
            variant="ghost"
            className="flex-col h-auto py-2"
            onClick={() =>
              navigate("/app/profile")
            }
          >

            <User className="h-5 w-5 mb-1" />

            <span className="text-xs">
              Profile
            </span>

          </Button>

          <Button
            variant="ghost"
            className="flex-col h-auto py-2"
            onClick={() =>
              navigate("/app/settings")
            }
          >

            <Settings className="h-5 w-5 mb-1" />

            <span className="text-xs">
              Settings
            </span>

          </Button>

        </div>

      </div>

    </div>
  );
}
