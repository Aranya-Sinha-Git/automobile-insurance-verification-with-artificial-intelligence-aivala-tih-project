import Sidebar from "@/app/components/web/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, AlertTriangle } from "lucide-react";
import { fraudTrends, fraudPatterns } from "@/app/data/mockData";

export default function FraudAnalytics() {
  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  
  const geographicData = [
    { region: 'Mumbai', cases: 45 },
    { region: 'Delhi', cases: 38 },
    { region: 'Bangalore', cases: 32 },
    { region: 'Hyderabad', cases: 28 },
    { region: 'Chennai', cases: 22 },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6 pt-16 md:pt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl mb-2">Fraud Analytics Dashboard</h1>
              <p className="text-gray-600">Demo analytics for interface review; not connected to live claims</p>
            </div>
            <Button disabled title="Export is not connected to live analytics">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Fraudulent Claims</p>
                    <p className="text-3xl mb-2">127</p>
                    <p className="text-sm text-red-600">+5% from last month</p>
                  </div>
                  <div className="bg-red-100 p-3 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Amount Saved</p>
                    <p className="text-3xl mb-2">₹18.5L</p>
                    <p className="text-sm text-green-600">+12% from last month</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Detection Rate</p>
                    <p className="text-3xl mb-2">94%</p>
                    <p className="text-sm text-blue-600">AI Accuracy</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="security_stages" className="space-y-4">
            <TabsList>
              <TabsTrigger value="security_stages">5-Stage Security Pipeline</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="patterns">Patterns</TabsTrigger>
              <TabsTrigger value="geographic">Geographic</TabsTrigger>
            </TabsList>

            <TabsContent value="security_stages" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-emerald-800 uppercase">Stage 1: Video metadata</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">—</p>
                    <p className="text-[11px] text-emerald-600 mt-1">Live aggregation unavailable</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-blue-800 uppercase">Stage 2: pHash</p>
                    <p className="text-2xl font-bold text-blue-700 mt-1">—</p>
                    <p className="text-[11px] text-blue-600 mt-1">Live aggregation unavailable</p>
                  </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-purple-800 uppercase">Stage 3: Duplicates</p>
                    <p className="text-2xl font-bold text-purple-700 mt-1">—</p>
                    <p className="text-[11px] text-purple-600 mt-1">Live aggregation unavailable</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-amber-800 uppercase">Stage 4: ELA</p>
                    <p className="text-2xl font-bold text-amber-700 mt-1">—</p>
                    <p className="text-[11px] text-amber-600 mt-1">Screening signal only</p>
                  </CardContent>
                </Card>
                <Card className="border-indigo-200 bg-indigo-50/50">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-indigo-800 uppercase">Stage 5: Local receipt</p>
                    <p className="text-2xl font-bold text-indigo-700 mt-1">—</p>
                    <p className="text-[11px] text-indigo-600 mt-1">Not a blockchain transaction</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>5-Stage Security Layer Verification Audit Breakdown</CardTitle>
                  <CardDescription>
                    Performance breakdown of each security filter stage across all submitted insurance claim payloads
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      {
                        stage: "Stage 1: Video Metadata & Decodability",
                        passRate: null,
                        failed: "Aggregate runtime metrics are not implemented yet.",
                        color: "bg-emerald-500",
                      },
                      {
                        stage: "Stage 2: Perceptual Hash (pHash) Structural Generation",
                        passRate: null,
                        failed: "Aggregate runtime metrics are not implemented yet.",
                        color: "bg-blue-500",
                      },
                      {
                        stage: "Stage 3: Duplicate Fraud Cross-Matching",
                        passRate: null,
                        failed: "Matches are stored in the local persistent fingerprint database.",
                        color: "bg-purple-500",
                      },
                      {
                        stage: "Stage 4: Error Level Analysis (ELA) Compression Scan",
                        passRate: null,
                        failed: "ELA is a review signal and cannot prove authenticity.",
                        color: "bg-amber-500",
                      },
                      {
                        stage: "Stage 5: YOLO/Qwen & Local Audit Receipt",
                        passRate: null,
                        failed: "Receipts are stored locally; no blockchain is connected.",
                        color: "bg-indigo-500",
                      },
                    ].map((item, idx) => (
                      <div key={idx} className="p-3 border rounded-xl bg-gray-50/50">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-semibold text-sm">{item.stage}</span>
                          <span className="text-sm font-bold">Not aggregated</span>
                        </div>
                        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden mb-1.5">
                          <div
                            className={`h-full ${item.color}`}
                            style={{ width: "0%" }}
                          />
                        </div>
                        <p className="text-xs text-gray-500">{item.failed}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Fraud Detection Trend</CardTitle>
                  <CardDescription>Monthly analysis of fraudulent claims</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={fraudTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total Claims" strokeWidth={2} />
                      <Line type="monotone" dataKey="flagged" stroke="#f59e0b" name="Flagged" strokeWidth={2} />
                      <Line type="monotone" dataKey="rejected" stroke="#ef4444" name="Rejected" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="patterns" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Fraud Type Distribution</CardTitle>
                    <CardDescription>Breakdown by fraud category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={fraudPatterns}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.type}: ${entry.percentage}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {fraudPatterns.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Fraud Patterns</CardTitle>
                    <CardDescription>Most common types detected</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {fraudPatterns.map((pattern, index) => (
                        <div key={index}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm">{pattern.type}</span>
                            <span className="text-sm font-medium">{pattern.count} cases</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full"
                              style={{ 
                                width: `${pattern.percentage}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="geographic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Geographic Distribution</CardTitle>
                  <CardDescription>Fraud cases by region</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={geographicData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="region" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="cases" fill="#ef4444" name="Fraud Cases" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
