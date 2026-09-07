import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import { offlineStorage } from "@/app/utils/offlineStorage";
import { syncManager } from "@/app/utils/syncManager";
import { useNetworkStatus } from "@/app/utils/networkStatus";
import { useState, useEffect } from "react";
import { Upload, RefreshCw, AlertCircle, CheckCircle, Clock, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

export function OfflineSync() {
  const networkStatus = useNetworkStatus();
  const [storageInfo, setStorageInfo] = useState(offlineStorage.getStorageInfo());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const refresh = () => setStorageInfo(offlineStorage.getStorageInfo());
    const interval = setInterval(() => {
      refresh();
    }, 5000);
    window.addEventListener("aivala-offline-storage-changed", refresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("aivala-offline-storage-changed", refresh);
    };
  }, []);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await syncManager.syncNow();
      setStorageInfo(offlineStorage.getStorageInfo());
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    setIsSyncing(true);
    try {
      await syncManager.retryFailed();
      setStorageInfo(offlineStorage.getStorageInfo());
    } finally {
      setIsSyncing(false);
    }
  };

  if (storageInfo.claimCount === 0) {
    return null;
  }

  return (
    <Card className={networkStatus.isServerReachable ? "border-blue-200 bg-blue-50" : "border-orange-200 bg-orange-50"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {networkStatus.isServerReachable ? (
              <Wifi className="h-4 w-4 text-blue-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-orange-600" />
            )}
            Saved Claims
          </CardTitle>
          <Badge variant={networkStatus.isServerReachable ? "default" : "secondary"}>
            {networkStatus.isServerReachable ? "Ready" : "Waiting"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{storageInfo.claimCount}</div>
            <div className="text-xs text-gray-500">Total Claims</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{storageInfo.pendingUploads}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{storageInfo.failedUploads}</div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
        </div>

        {/* Storage Progress */}
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Storage</span>
            <span>{storageInfo.usagePercentage.toFixed(0)}% used</span>
          </div>
          <Progress value={storageInfo.usagePercentage} className="h-2" />
          <div className="text-xs text-gray-500 mt-1">
            {offlineStorage.formatSize(storageInfo.totalSize)} / {offlineStorage.formatSize(storageInfo.maxSize)}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {networkStatus.isServerReachable && storageInfo.pendingUploads > 0 && (
            <Button 
              onClick={handleSyncNow} 
              disabled={isSyncing}
              className="w-full"
              size="sm"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {storageInfo.pendingUploads} Claim{storageInfo.pendingUploads > 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}

          {storageInfo.failedUploads > 0 && (
            <Button 
              onClick={handleRetryFailed} 
              disabled={!networkStatus.isServerReachable || isSyncing}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry {storageInfo.failedUploads} Failed Upload{storageInfo.failedUploads > 1 ? 's' : ''}
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {!networkStatus.isServerReachable && (
          <div className="flex items-start gap-2 text-xs text-orange-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              {networkStatus.isOnline
                ? "AI server unavailable. Claims will retry automatically."
                : "Offline. Claims will submit automatically when connectivity returns."}
            </span>
          </div>
        )}

        {networkStatus.isServerReachable && storageInfo.pendingUploads === 0 && storageInfo.failedUploads === 0 && (
          <div className="flex items-start gap-2 text-xs text-green-700">
            <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>All claims synced successfully!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
