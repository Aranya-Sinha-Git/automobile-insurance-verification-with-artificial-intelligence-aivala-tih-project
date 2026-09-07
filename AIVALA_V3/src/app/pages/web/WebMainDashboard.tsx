import Sidebar from "@/app/components/web/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Search, Bell, User } from "lucide-react";
import { fraudTrends, fraudPatterns, mockClaims } from "@/app/data/mockData";

export default function WebMainDashboard() {
  const stats = [
    { label: "Today's Claims", value: "47", change: "+12%", icon: Clock, color: "blue" },
    { label: "Fraud Alerts", value: "8", change: "+3%", icon: AlertTriangle, color: "orange" },
    { label: "Processed", value: "35", change: "+8%", icon: CheckCircle, color: "green" },
    { label: "Savings", value: "₹2.4L", change: "+15%", icon: TrendingUp, color: "purple" },
  ];

  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        {/* Top Bar */}
        <div className="bg-white border-b p-4 md:p-4 pl-16 md:pl-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input placeholder="Search claims, customers..." className="pl-10" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-medium">Anita Desai</p>
                  <p className="text-xs text-gray-500">Senior Agent</p>
                </div>
                <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
                  <User className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl mb-2">Dashboard Overview</h1>
            <p className="text-gray-600">Welcome back, here's what's happening today</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                        <p className="text-3xl mb-2">{stat.value}</p>
                        <p className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                          {stat.change} from yesterday
                        </p>
                      </div>
                      <div className={`bg-${stat.color}-100 p-3 rounded-lg`}>
                        <Icon className={`h-6 w-6 text-${stat.color}-600`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Fraud Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Fraud Detection Trend</CardTitle>
                <CardDescription>Last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={fraudTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total Claims" />
                    <Line type="monotone" dataKey="flagged" stroke="#f59e0b" name="Flagged" />
                    <Line type="monotone" dataKey="rejected" stroke="#ef4444" name="Rejected" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Fraud Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Fraud Type Distribution</CardTitle>
                <CardDescription>Current month</CardDescription>
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
                      outerRadius={80}
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
          </div>

          {/* Recent Claims */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Claims</CardTitle>
                  <CardDescription>Latest submissions requiring review</CardDescription>
                </div>
                <Button variant="outline">View All</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Claim ID</th>
                      <th className="text-left py-3 px-4">Customer</th>
                      <th className="text-left py-3 px-4">Type</th>
                      <th className="text-left py-3 px-4">5-Stage Audit</th>
                      <th className="text-left py-3 px-4">Amount</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockClaims.slice(0, 5).map((claim) => (
                      <tr key={claim.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{claim.id}</td>
                        <td className="py-3 px-4">{claim.customerName}</td>
                        <td className="py-3 px-4 capitalize">{claim.type}</td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-emerald-600">
                            Verified
                          </span>
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
                        <td className="py-3 px-4">
                          <Button variant="ghost" size="sm">Review</Button>
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