import Sidebar from "@/app/components/web/Sidebar";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Search, Download, Eye, CheckCircle, XCircle, Flag } from "lucide-react";
import { mockClaims } from "@/app/data/mockData";
import { useState } from "react";
import FiveStageSecurityCard from "@/app/components/security/FiveStageSecurityCard";

export default function ClaimsManagement() {
  const [selectedClaim, setSelectedClaim] = useState<typeof mockClaims[0] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const visibleClaims = mockClaims.filter((claim) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [claim.id, claim.customerName, claim.customerId].some((value) => String(value).toLowerCase().includes(query));
    return matchesSearch && (status === "all" || claim.status === status) && (type === "all" || claim.type === type);
  });

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6 pt-16 md:pt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl mb-2">Claims Management</h1>
              <div className="flex items-center gap-2"><p className="text-gray-600">Demo claims for interface review</p><Badge variant="secondary">DEMO DATA</Badge></div>
            </div>
            <Button disabled title="Export is not connected to a live claims service">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>

          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by ID, customer name..." className="pl-10" />
                  </div>
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">Claims ({visibleClaims.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4">Claim ID</th>
                          <th className="text-left py-3 px-4">Customer</th>
                          <th className="text-left py-3 px-4">Vehicle Info</th>
                          <th className="text-left py-3 px-4">Audit Status</th>
                          <th className="text-left py-3 px-4">Amount</th>
                          <th className="text-left py-3 px-4">Status</th>
                          <th className="text-left py-3 px-4">Submitted</th>
                          <th className="text-left py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleClaims.map((claim) => (
                          <tr key={claim.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{claim.id}</td>
                            <td className="py-3 px-4">
                              <div>
                                <p className="font-medium">{claim.customerName}</p>
                                <p className="text-sm text-gray-500">{claim.customerId}</p>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm">{claim.vehicleInfo || 'N/A'}</td>
                            <td className="py-3 px-4">
                              <span className="text-sm font-medium text-blue-600">Demo audit details</span>
                            </td>
                            <td className="py-3 px-4">₹{claim.estimatedCost.toLocaleString()}</td>
                            <td className="py-3 px-4">
                              <Badge 
                                variant={claim.status === 'approved' ? 'default' : claim.status === 'pending' ? 'secondary' : 'destructive'}
                                className={
                                  claim.status === 'approved' ? 'bg-green-500' : 
                                  claim.status === 'pending' ? 'bg-yellow-500' : 
                                  claim.status === 'flagged' ? 'bg-orange-500' : 'bg-red-500'
                                }
                              >
                                {claim.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {new Date(claim.submittedAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setSelectedClaim(claim)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {claim.status === 'pending' && (
                                  <>
                                    <Button disabled title="Approval is not connected" variant="ghost" size="sm" className="text-green-600">
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button disabled title="Rejection is not connected" variant="ghost" size="sm" className="text-red-600">
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                    <Button disabled title="Review flagging is not connected" variant="ghost" size="sm" className="text-orange-600">
                                      <Flag className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Claim Detail Modal */}
      <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Claim Details - {selectedClaim?.id}</DialogTitle>
            <DialogDescription>Review claim information and AI analysis</DialogDescription>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-medium">{selectedClaim.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Security Status</p>
                  <p className="font-medium text-emerald-600">5-Stage Cleared</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Estimated Cost</p>
                  <p className="font-medium">₹{selectedClaim.estimatedCost.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="font-medium">{selectedClaim.location}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Description</p>
                <p>{selectedClaim.description}</p>
              </div>

              {/* 5-Stage Security Pipeline Audit Report */}
              <div className="mt-4">
                <FiveStageSecurityCard defaultExpanded={true} />
              </div>

              <div className="flex gap-2 pt-2">
                <Button disabled className="bg-green-600 hover:bg-green-700">Approve unavailable</Button>
                <Button disabled variant="destructive">Reject unavailable</Button>
                <Button disabled variant="outline">Flag unavailable</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
