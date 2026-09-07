import Sidebar from "@/app/components/web/Sidebar";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { CheckCircle, Clock, XCircle, ExternalLink } from "lucide-react";
import { settlements } from "@/app/data/mockData";

export default function SettlementManagement() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6 pt-16 md:pt-6">
          <div className="mb-6">
            <h1 className="text-3xl mb-2">Settlement Management</h1>
            <p className="text-gray-600">Track and manage claim settlements</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Pending Settlements</p>
                    <p className="text-3xl">1</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Completed Today</p>
                    <p className="text-3xl">2</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                    <p className="text-3xl">₹1.7L</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4">Settlement ID</th>
                      <th className="text-left py-3 px-4">Claim ID</th>
                      <th className="text-left py-3 px-4">Amount</th>
                      <th className="text-left py-3 px-4">Method</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Transaction</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((settlement) => (
                      <tr key={settlement.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{settlement.id}</td>
                        <td className="py-3 px-4">{settlement.claimId}</td>
                        <td className="py-3 px-4">₹{settlement.amount.toLocaleString()}</td>
                        <td className="py-3 px-4 capitalize">{settlement.method.replace('_', ' ')}</td>
                        <td className="py-3 px-4">
                          <Badge 
                            variant={settlement.status === 'completed' ? 'default' : settlement.status === 'processing' ? 'secondary' : 'destructive'}
                            className={
                              settlement.status === 'completed' ? 'bg-green-500' : 
                              settlement.status === 'processing' ? 'bg-yellow-500' : 'bg-red-500'
                            }
                          >
                            {settlement.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {settlement.transactionHash ? (
                            <Button variant="ghost" size="sm" className="text-blue-600">
                              {settlement.transactionHash.slice(0, 8)}...
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Button variant="outline" size="sm">View</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}