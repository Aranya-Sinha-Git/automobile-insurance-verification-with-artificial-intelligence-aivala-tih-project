import Sidebar from "@/app/components/web/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UserPlus, Mail } from "lucide-react";
import { teamMembers } from "@/app/data/mockData";

export default function TeamManagement() {
  const performanceData = teamMembers.map(member => ({
    name: member.name.split(' ')[0],
    processed: member.claimsProcessed,
    rate: member.approvalRate
  }));

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6 pt-16 md:pt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl mb-2">Team Management</h1>
              <p className="text-gray-600">Monitor team performance and workload</p>
            </div>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Performance</CardTitle>
                <CardDescription>Claims processed vs approval rate</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="processed" fill="#3b82f6" name="Claims Processed" />
                    <Bar yAxisId="right" dataKey="rate" fill="#10b981" name="Approval Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team Statistics</CardTitle>
                <CardDescription>Overall team metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Claims Processed</span>
                    <span className="text-2xl font-bold">1,146</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Average Approval Rate</span>
                    <span className="text-2xl font-bold">86.5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Avg Processing Time</span>
                    <span className="text-2xl font-bold">13.75 min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Active Members</span>
                    <span className="text-2xl font-bold">3/4</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {teamMembers.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Avatar className="h-12 w-12 bg-blue-600">
                      <AvatarFallback className="text-white">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-medium">{member.name}</h3>
                      <p className="text-sm text-gray-500">{member.role}</p>
                    </div>
                    <Badge 
                      variant={member.status === 'active' ? 'default' : 'secondary'}
                      className={member.status === 'active' ? 'bg-green-500' : member.status === 'away' ? 'bg-yellow-500' : 'bg-gray-500'}
                    >
                      {member.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Claims Processed</span>
                      <span className="font-medium">{member.claimsProcessed}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Approval Rate</span>
                      <span className="font-medium">{member.approvalRate}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Avg Time</span>
                      <span className="font-medium">{member.avgProcessingTime}</span>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full">
                    <Mail className="mr-2 h-4 w-4" />
                    Contact
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}