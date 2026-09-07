import { useNavigate } from "react-router";
import { logoutFirebase } from "@/app/utils/firebase";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import { ArrowLeft, Bell, Lock, Database, LogOut, Wifi, Shield, Trash2, Moon } from "lucide-react";
import { offlineStorage } from "@/app/utils/offlineStorage";
import { useState } from "react";
import { toast } from "sonner";
import { getHFSpaceURL, setHFSpaceURL } from "@/app/utils/huggingFaceService";
import { useTheme } from "next-themes";

export default function Settings() {
  const navigate = useNavigate();
  const [storageInfo, setStorageInfo] = useState(offlineStorage.getStorageInfo());
  const [offlineMode, setOfflineMode] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const { theme, setTheme } = useTheme();

  const handleClearOfflineData = () => {
    if (confirm('Are you sure you want to clear all offline data? This cannot be undone.')) {
      offlineStorage.clearAll();
      setStorageInfo(offlineStorage.getStorageInfo());
      toast.success('Offline data cleared');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl">Settings</h1>
      </div>

      <div className="p-6 space-y-4">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="h-5 w-5 text-gray-400" />
                <div>
                  <Label>Dark mode</Label>
                  <p className="text-xs text-gray-500">Use a darker color scheme throughout the app</p>
                </div>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                aria-label="Toggle dark mode"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-gray-400" />
                <Label>Push Notifications</Label>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-gray-400" />
                <Label>Email Notifications</Label>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Offline Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offline Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wifi className="h-5 w-5 text-gray-400" />
                <div>
                  <Label>Enable Offline Mode</Label>
                  <p className="text-xs text-gray-500">Record claims without internet</p>
                </div>
              </div>
              <Switch checked={offlineMode} onCheckedChange={setOfflineMode} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-gray-400" />
                <div>
                  <Label>Auto-sync when online</Label>
                  <p className="text-xs text-gray-500">Upload claims automatically</p>
                </div>
              </div>
              <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            </div>
            
            {/* Storage Info */}
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Offline Claims:</span>
                <span className="font-medium">{storageInfo.claimCount} / {storageInfo.maxClaims}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Storage Used:</span>
                <span className="font-medium">{offlineStorage.formatSize(storageInfo.totalSize)} / {offlineStorage.formatSize(storageInfo.maxSize)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pending Uploads:</span>
                <span className="font-medium text-orange-600">{storageInfo.pendingUploads}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Inference Endpoint */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Inference Server Endpoint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">AI Server API URL (Local PC, Ngrok Tunnel, or Cloud Gateway)</Label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                defaultValue={getHFSpaceURL()}
                onChange={(e) => {
                  localStorage.removeItem("security_backend_url");
                  setHFSpaceURL(e.target.value);
                }}
                placeholder="https://curfew-stump-tripod.ngrok-free.dev"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border text-xs font-medium"
                onClick={() => {
                  const input = document.querySelector('input[placeholder*="ngrok"]') as HTMLInputElement;
                  if (input) {
                    input.value = "https://curfew-stump-tripod.ngrok-free.dev";
                    localStorage.setItem("hf_space_url", "https://curfew-stump-tripod.ngrok-free.dev");
                    localStorage.removeItem("security_backend_url");
                  }
                }}
              >
                Use AIVALA ngrok gateway
              </button>
              <button
                type="button"
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border text-xs font-medium"
                onClick={() => {
                  const input = document.querySelector('input[placeholder*="ngrok"]') as HTMLInputElement;
                  if (input) {
                    input.value = "https://fabrix13-aivala.hf.space";
                    localStorage.setItem("hf_space_url", "https://fabrix13-aivala.hf.space");
                  }
                }}
              >
                Set to Cloud AI Gateway
              </button>
            </div>
            <p className="text-xs text-gray-500">
              APK communication uses the <strong>AIVALA ngrok HTTPS gateway</strong> so the device never targets your PC's localhost address.
            </p>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Privacy & Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex gap-2 mb-2">
                <Shield className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <strong>End-to-End Encryption:</strong> All claim videos are encrypted on-device before transmission. Raw videos are purged after damage extraction in compliance with IRDAI guidelines.
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/app/dashboard")}>
              <Lock className="mr-2 h-4 w-4" />
              Change Password
            </Button>
            <Button variant="outline" className="w-full justify-start text-red-600" onClick={handleClearOfflineData}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Offline Data
            </Button>
          </CardContent>
        </Card>

        <Button
          variant="destructive"
          className="w-full"
          onClick={async () => {
            await logoutFirebase();
            navigate("/", { replace: true });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
