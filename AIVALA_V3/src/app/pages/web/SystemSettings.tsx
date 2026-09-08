import Sidebar from "@/app/components/web/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Save, Key, Database, Bell } from "lucide-react";

export default function SystemSettings() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6 pt-16 md:pt-6">
          <div className="mb-6">
            <h1 className="text-3xl mb-2">System Settings</h1>
            <p className="text-gray-600">Demo configuration screens; changes are not connected to backend services</p>
          </div>

          <Tabs defaultValue="api" className="space-y-4">
            <TabsList>
              <TabsTrigger value="api">API Keys</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="api" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>API Key Management</CardTitle>
                  <CardDescription>Manage your API keys for system integration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Production API Key</Label>
                    <div className="flex gap-2">
                      <Input type="password" value="••••••••••••••••••••••••" readOnly />
                      <Button variant="outline" disabled>Regenerate</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Development API Key</Label>
                    <div className="flex gap-2">
                      <Input type="password" value="••••••••••••••••••••••••" readOnly />
                      <Button variant="outline" disabled>Regenerate</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Third-party Integrations</CardTitle>
                  <CardDescription>Connect external services</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium">Local Audit Receipts</p>
                        <p className="text-sm text-gray-500">SHA-256 or HMAC-SHA256 receipts stored locally</p>
                      </div>
                    </div>
                    <Switch defaultChecked disabled />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium">Payment Gateway</p>
                        <p className="text-sm text-gray-500">Direct settlements</p>
                      </div>
                    </div>
                    <Switch defaultChecked disabled />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Templates</CardTitle>
                  <CardDescription>Configure notification preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-gray-400" />
                      <Label>Fraud Alert Notifications</Label>
                    </div>
                    <Switch defaultChecked disabled />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-gray-400" />
                      <Label>Claim Approval Notifications</Label>
                    </div>
                    <Switch defaultChecked disabled />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-gray-400" />
                      <Label>Settlement Completion</Label>
                    </div>
                    <Switch defaultChecked disabled />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Demo audit entries for interface review</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b">
                      <span>Claim CLM-2024-003 approved by Anita Desai</span>
                      <span className="text-gray-500">2 hours ago</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span>Settlement SET-003 initiated</span>
                      <span className="text-gray-500">5 hours ago</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span>API key regenerated for production</span>
                      <span className="text-gray-500">1 day ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
