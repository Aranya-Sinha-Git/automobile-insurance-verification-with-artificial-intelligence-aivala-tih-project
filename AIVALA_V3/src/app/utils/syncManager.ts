// Automatically submits device-local claims when the AI server is reachable.

import { toast } from "sonner";
import {
  SecurityGatewayError,
  verifyClaimWithSecurityBackend,
  waitForSecurityGatewayReady,
} from "./securityBackendService";
import { offlineStorage, type OfflineClaim } from "./offlineStorage";

class SyncManager {
  private isSyncing = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  startAutoSync() {
    if (this.syncInterval) return;
    void this.syncPendingClaims(true);
    this.syncInterval = setInterval(() => {
      void this.syncPendingClaims(true);
    }, 20_000);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async syncPendingClaims(
    silent = false,
  ): Promise<{ success: number; failed: number }> {
    if (this.isSyncing || !navigator.onLine) {
      return { success: 0, failed: 0 };
    }

    const queue = await offlineStorage.getSyncQueueAsync();
    const queuedIds = [...new Set(queue.pendingUploads)];
    if (queuedIds.length === 0) return { success: 0, failed: 0 };

    const serverReady = await waitForSecurityGatewayReady();
    if (!serverReady) return { success: 0, failed: 0 };

    this.isSyncing = true;
    let successCount = 0;
    let failedCount = 0;
    let rejectedCount = 0;
    if (!silent) toast.info(`Submitting ${queuedIds.length} saved claim(s)...`);

    try {
      for (const claimId of queuedIds) {
        if ((window as any).aivalaActiveClaimId === claimId) continue;
        const claim = await offlineStorage.getClaimAsync(claimId);
        if (!claim) {
          await offlineStorage.completeUpload(claimId);
          continue;
        }

        try {
          await this.uploadClaim(claim);
          await offlineStorage.completeUpload(claimId);
          successCount += 1;
        } catch (error) {
          console.warn(`Deferred claim ${claimId} could not be submitted:`, error);
          if (
            error instanceof SecurityGatewayError &&
            error.category === "invalid_evidence"
          ) {
            await offlineStorage.updateClaim(
              claimId,
              { status: "rejected", rejectionReason: error.message },
              false,
            );
            await offlineStorage.completeUpload(claimId);
            const localClaims = JSON.parse(localStorage.getItem("claims") || "[]");
            localStorage.setItem(
              "claims",
              JSON.stringify(
                localClaims.map((item: any) =>
                  item.id === claimId
                    ? { ...item, status: "rejected", rejectionReason: error.message }
                    : item,
                ),
              ),
            );
            rejectedCount += 1;
            continue;
          }
          await offlineStorage.markAsFailed(claimId);
          failedCount += 1;
        }
      }
    } finally {
      this.isSyncing = false;
    }

    if (successCount > 0) {
      toast.success(
        `${successCount} saved claim${successCount === 1 ? "" : "s"} submitted`,
      );
    }
    if (!silent && failedCount > 0) {
      toast.error("Some claims are still saved on this device and will retry later.");
    }
    if (rejectedCount > 0) {
      toast.error(
        `${rejectedCount} saved claim${rejectedCount === 1 ? " needs" : "s need"} a new evidence recording.`,
      );
    }

    return { success: successCount, failed: failedCount + rejectedCount };
  }

  private async uploadClaim(claim: OfflineClaim): Promise<void> {
    if (!(claim.videoBlob instanceof Blob) || claim.videoBlob.size === 0) {
      throw new Error("Saved evidence video is unavailable");
    }

    await offlineStorage.updateClaim(
      claim.id,
      { status: "processing" },
      false,
    );
    await verifyClaimWithSecurityBackend(claim.videoBlob, claim.id);
  }

  async syncNow(): Promise<{ success: number; failed: number }> {
    if (!navigator.onLine) {
      toast.error("No internet connection. Your evidence remains saved.");
      return { success: 0, failed: 0 };
    }
    return this.syncPendingClaims(false);
  }

  async retryFailed(): Promise<{ success: number; failed: number }> {
    await offlineStorage.retryFailed();
    return this.syncNow();
  }

  isSyncInProgress(): boolean {
    return this.isSyncing;
  }
}

export const syncManager = new SyncManager();

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void syncManager.syncPendingClaims(true);
  });
}
