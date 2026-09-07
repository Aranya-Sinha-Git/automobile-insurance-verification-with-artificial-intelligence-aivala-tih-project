import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { ArrowLeft, FileText, Search, Download } from "lucide-react";

export default function ClaimsHistory() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const claims = JSON.parse(localStorage.getItem("claims") || "[]").map(
    (claim: any) => ({
      ...claim,
      type: claim.type || "auto",
      estimatedCost: claim.estimatedCost ?? 0,
      submittedAt:
        claim.submittedAt || claim.createdAt || claim.date || new Date().toISOString(),
    }),
  );
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleClaims = normalizedSearch
    ? claims.filter((claim: any) =>
        [claim.id, claim.type, claim.status].some((value) =>
          String(value || "").toLowerCase().includes(normalizedSearch),
        ),
      )
    : claims;

  const openClaim = (claim: any) => {
    const destination =
      claim.status === "processing" ||
      claim.status === "pending" ||
      claim.status === "pending_upload"
        ? `/app/processing/${claim.id}`
        : `/app/results/${claim.id}`;

    navigate(destination);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b p-4">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl">Claims History</h1>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search claims..."
            className="pl-10"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {visibleClaims.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-gray-500">
              {claims.length === 0
                ? "No claims submitted yet."
                : "No claims match your search."}
            </CardContent>
          </Card>
        ) : visibleClaims.map((claim: any) => (
          <Card
            key={claim.id}
            role="button"
            tabIndex={0}
            aria-label={`Open claim ${claim.id}`}
            className="hover:shadow-md transition-shadow cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            onClick={() => openClaim(claim)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openClaim(claim);
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">{claim.id}</div>
                    <div className="text-sm text-gray-600">{claim.type.charAt(0).toUpperCase() + claim.type.slice(1)} Insurance</div>
                  </div>
                </div>
                <Badge 
                  variant={claim.status === 'approved' ? 'default' : claim.status === 'pending' ? 'secondary' : 'destructive'}
                  className={
                    claim.status === 'approved' ? 'bg-green-500' : 
                    claim.status === 'pending' ? 'bg-yellow-500' : 
                    claim.status === 'flagged' ? 'bg-orange-500' : 'bg-red-500'
                  }
                >
                  {String(claim.status).replaceAll("_", " ")}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <p className="text-gray-500">Estimated Settlement</p>
                  <p className="font-medium">₹{claim.estimatedCost.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Security Audit</p>
                  <p className="font-medium text-blue-600">Open for audit details</p>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Submitted: {new Date(claim.submittedAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="sticky bottom-20 flex justify-end px-4 pointer-events-none">
        <Button size="icon" className="rounded-full h-14 w-14 shadow-lg pointer-events-auto">
          <Download className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
