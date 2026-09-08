// Device-local claim and video persistence backed by IndexedDB.

export type OfflineClaimStatus =
  | "draft"
  | "pending_upload"
  | "processing"
  | "approved"
  | "no_damage"
  | "review_required"
  | "system_error"
  | "rejected"
  | "failed_upload";

export interface OfflineClaim {
  id: string;
  ownerId?: string;
  type: "auto";
  status: OfflineClaimStatus;
  videoBlob?: Blob;
  videoFileName?: string;
  videoMimeType?: string;
  claimData: Record<string, unknown>;
  createdAt: string;
  lastModified: string;
  size: number;
  [key: string]: unknown;
}

export interface SyncQueue {
  pendingUploads: string[];
  failedUploads: string[];
  lastSyncAttempt?: string;
}

class OfflineStorageManager {
  private readonly DB_NAME = "aivala_offline_db";
  private readonly DB_VERSION = 2;
  private readonly STORE_CLAIMS = "claims";
  private readonly STORE_QUEUE = "queue";
  private readonly STORAGE_KEY_CLAIMS_FALLBACK = "aivala_offline_claims";
  private readonly STORAGE_KEY_QUEUE_FALLBACK = "aivala_sync_queue";
  private readonly MAX_STORAGE_SIZE = 500 * 1024 * 1024;
  private readonly MAX_CLAIMS = 25;

  private readonly dbPromise: Promise<IDBDatabase | null>;
  private claimsCache: OfflineClaim[] = [];
  private queueCache: SyncQueue = { pendingUploads: [], failedUploads: [] };
  private activeOwnerId: string | null = null;
  private ownerSelectionVersion = 0;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private ownerId(): string {
    return this.activeOwnerId || "local-development";
  }

  private claimsFallbackKey(): string {
    return `${this.STORAGE_KEY_CLAIMS_FALLBACK}_${this.ownerId()}`;
  }

  private queueFallbackKey(): string {
    return `${this.STORAGE_KEY_QUEUE_FALLBACK}_${this.ownerId()}`;
  }

  /** Select the account whose local claims and queue are visible to the app. */
  async setActiveOwner(ownerId: string | null): Promise<void> {
    const version = ++this.ownerSelectionVersion;
    this.activeOwnerId = ownerId;
    this.claimsCache = [];
    this.queueCache = { pendingUploads: [], failedUploads: [] };
    if (ownerId) {
      await this.ready();
      if (version !== this.ownerSelectionVersion) return;
      const db = await this.dbPromise;
      if (db) await this.refreshCachesFromIDB(db);
      else this.loadFromFallback();
      if (version !== this.ownerSelectionVersion) {
        this.claimsCache = [];
        this.queueCache = { pendingUploads: [], failedUploads: [] };
      }
    }
  }

  private loadFromFallback() {
    try {
      const claims = localStorage.getItem(this.claimsFallbackKey());
      const queue = localStorage.getItem(this.queueFallbackKey());
      if (claims) this.claimsCache = JSON.parse(claims);
      if (queue) this.queueCache = JSON.parse(queue);
    } catch (error) {
      console.warn("Offline fallback load failed:", error);
    }
  }

  private initDB(): Promise<IDBDatabase | null> {
    if (typeof window === "undefined" || !window.indexedDB) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_CLAIMS)) {
          db.createObjectStore(this.STORE_CLAIMS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(this.STORE_QUEUE)) {
          db.createObjectStore(this.STORE_QUEUE, { keyPath: "id" });
        }
      };

      request.onsuccess = async () => {
        const db = request.result;
        await this.refreshCachesFromIDB(db);
        resolve(db);
      };

      request.onerror = () => {
        console.error("Failed to open offline IndexedDB:", request.error);
        resolve(null);
      };
    });
  }

  private requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private transactionComplete(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private async refreshCachesFromIDB(db: IDBDatabase) {
    try {
      const claimTx = db.transaction(this.STORE_CLAIMS, "readonly");
      const claims = await this.requestResult<OfflineClaim[]>(
        claimTx.objectStore(this.STORE_CLAIMS).getAll(),
      );
      this.claimsCache = (claims || []).map((claim) => this.hydrateClaim(claim)).filter(
        (claim) => (claim.ownerId || "local-development") === this.ownerId(),
      );

      const queueTx = db.transaction(this.STORE_QUEUE, "readonly");
      const queueRecord = await this.requestResult<any>(
        queueTx.objectStore(this.STORE_QUEUE).get(`sync_queue_${this.ownerId()}`),
      );
      if (queueRecord?.data) this.queueCache = queueRecord.data;
      this.persistFallbacks();
    } catch (error) {
      console.warn("Failed to refresh offline caches:", error);
    }
  }

  private persistFallbacks() {
    try {
      const lightweightClaims = this.claimsCache.map((claim) => ({
        ...claim,
        videoBlob: claim.videoBlob ? "[Persisted in IndexedDB]" : undefined,
      }));
      localStorage.setItem(
        this.claimsFallbackKey(),
        JSON.stringify(lightweightClaims),
      );
      localStorage.setItem(
        this.queueFallbackKey(),
        JSON.stringify(this.queueCache),
      );
    } catch {
      // IndexedDB remains authoritative when localStorage quota is unavailable.
    }
  }

  private notifyChanged() {
    this.persistFallbacks();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aivala-offline-storage-changed"));
    }
  }

  async ready(): Promise<void> {
    await this.dbPromise;
  }

  private hydrateClaim(claim: OfflineClaim): OfflineClaim {
    const persisted = claim as OfflineClaim & {
      videoData?: ArrayBuffer | Uint8Array;
    };
    if (persisted.videoBlob || !persisted.videoData) return claim;

    const bytes = persisted.videoData;
    const buffer = bytes instanceof ArrayBuffer
      ? bytes
      : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return {
      ...claim,
      videoBlob: new Blob([buffer], {
        type: claim.videoMimeType || "video/webm",
      }),
    };
  }

  private blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error || new Error("Unable to read video evidence"));
      reader.readAsArrayBuffer(blob);
    });
  }

  private async putClaimRecord(
    db: IDBDatabase,
    claim: OfflineClaim,
    videoData?: ArrayBuffer,
  ): Promise<void> {
    const persistedClaim = { ...claim } as OfflineClaim & {
      videoData?: ArrayBuffer;
    };
    if (videoData) {
      delete persistedClaim.videoBlob;
      persistedClaim.videoData = videoData;
    }
    const transaction = db.transaction(this.STORE_CLAIMS, "readwrite");
    transaction.objectStore(this.STORE_CLAIMS).put(persistedClaim);
    await this.transactionComplete(transaction);
  }

  async saveClaim(claim: OfflineClaim, queueForSync = true): Promise<boolean> {
    try {
      await this.ready();
      const existing = this.claimsCache.find((item) => item.id === claim.id);
      let otherClaims = this.claimsCache.filter((item) => item.id !== claim.id);

      if (!existing && otherClaims.length >= this.MAX_CLAIMS) {
        // Evict oldest claims to make room instead of rejecting
        otherClaims.sort((a, b) => new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime());
        otherClaims = otherClaims.slice(otherClaims.length - this.MAX_CLAIMS + 1);
      }

      // Android WebViews can reject structured-cloning a File returned by
      // MediaRecorder, while Blob is consistently supported by IndexedDB.
      // File.slice() returns a Blob view without synchronously copying the
      // complete recording on the UI thread. Preserve the filename separately.
      const persistableVideo =
        typeof File !== "undefined" && claim.videoBlob instanceof File
          ? claim.videoBlob.slice(0, claim.videoBlob.size, claim.videoMimeType || claim.videoBlob.type)
          : claim.videoBlob;
      const normalized: OfflineClaim = {
        ...claim,
        ownerId: claim.ownerId || this.ownerId(),
        lastModified: claim.lastModified || new Date().toISOString(),
        videoBlob: persistableVideo,
        size: persistableVideo?.size || claim.size || 0,
      };
      this.claimsCache = [...otherClaims, normalized];

      const db = await this.dbPromise;
      if (db) {
        try {
          await this.putClaimRecord(db, normalized);
        } catch (blobError) {
          // Older Android WebViews can preview a Blob but fail to structured-clone
          // it into IndexedDB. Retry with a plain ArrayBuffer, which those WebViews
          // support consistently. The conversion is asynchronous and avoids a UI
          // thread freeze while the recording is being saved.
          if (!persistableVideo) throw blobError;
          const videoData = await this.blobToArrayBuffer(persistableVideo);
          await this.putClaimRecord(db, normalized, videoData);
        }
      }

      if (
        queueForSync &&
        ["draft", "pending_upload", "failed_upload", "processing"].includes(
          normalized.status,
        )
      ) {
        await this.addToSyncQueue(normalized.id);
      } else {
        this.notifyChanged();
      }
      return true;
    } catch (error) {
      console.error("Failed to persist offline claim:", error);
      return false;
    }
  }

  getAllClaims(): OfflineClaim[] {
    return this.claimsCache.filter(
      (claim) => (claim.ownerId || "local-development") === this.ownerId(),
    );
  }

  async getAllClaimsAsync(): Promise<OfflineClaim[]> {
    await this.ready();
    return this.getAllClaims();
  }

  getClaim(id: string): OfflineClaim | null {
    return this.getAllClaims().find((claim) => claim.id === id) || null;
  }

  async getClaimAsync(id: string): Promise<OfflineClaim | null> {
    const db = await this.dbPromise;
    if (!db) return this.getClaim(id);

    try {
      const transaction = db.transaction(this.STORE_CLAIMS, "readonly");
      const storedClaim = await this.requestResult<OfflineClaim | undefined>(
        transaction.objectStore(this.STORE_CLAIMS).get(id),
      );
      const claim = storedClaim ? this.hydrateClaim(storedClaim) : undefined;
      const belongsToActiveOwner = Boolean(
        claim && (claim.ownerId || "local-development") === this.ownerId(),
      );
      if (belongsToActiveOwner && claim) {
        const index = this.claimsCache.findIndex((item) => item.id === id);
        if (index >= 0) this.claimsCache[index] = claim;
        else this.claimsCache.push(claim);
      }
      return belongsToActiveOwner ? claim || null : null;
    } catch {
      return this.getClaim(id);
    }
  }

  async updateClaim(
    id: string,
    updates: Partial<OfflineClaim>,
    queueForSync = false,
  ): Promise<boolean> {
    const existing = await this.getClaimAsync(id);
    if (!existing) return false;
    return this.saveClaim(
      {
        ...existing,
        ...updates,
        lastModified: new Date().toISOString(),
      },
      queueForSync,
    );
  }

  async deleteClaim(id: string): Promise<void> {
    await this.ready();
    this.claimsCache = this.claimsCache.filter((claim) => claim.id !== id);
    const db = await this.dbPromise;
    if (db) {
      const transaction = db.transaction(this.STORE_CLAIMS, "readwrite");
      transaction.objectStore(this.STORE_CLAIMS).delete(id);
      await this.transactionComplete(transaction);
    }
    await this.removeFromSyncQueue(id);
  }

  getSyncQueue(): SyncQueue {
    return {
      ...this.queueCache,
      pendingUploads: [...this.queueCache.pendingUploads],
      failedUploads: [...this.queueCache.failedUploads],
    };
  }

  async getSyncQueueAsync(): Promise<SyncQueue> {
    await this.ready();
    return this.getSyncQueue();
  }

  async addToSyncQueue(claimId: string): Promise<void> {
    if (!this.queueCache.pendingUploads.includes(claimId)) {
      this.queueCache.pendingUploads.push(claimId);
    }
    await this.persistQueue();
  }

  private async removeFromSyncQueue(claimId: string): Promise<void> {
    this.queueCache.pendingUploads = this.queueCache.pendingUploads.filter(
      (id) => id !== claimId,
    );
    this.queueCache.failedUploads = this.queueCache.failedUploads.filter(
      (id) => id !== claimId,
    );
    await this.persistQueue();
  }

  async markAsFailed(claimId: string): Promise<void> {
    if (!this.queueCache.pendingUploads.includes(claimId)) {
      this.queueCache.pendingUploads.push(claimId);
    }
    if (!this.queueCache.failedUploads.includes(claimId)) {
      this.queueCache.failedUploads.push(claimId);
    }
    this.queueCache.lastSyncAttempt = new Date().toISOString();
    await this.updateClaim(claimId, { status: "failed_upload" }, false);
    await this.persistQueue();
  }

  async retryFailed(): Promise<void> {
    for (const id of this.queueCache.failedUploads) {
      if (!this.queueCache.pendingUploads.includes(id)) {
        this.queueCache.pendingUploads.push(id);
      }
      await this.updateClaim(id, { status: "pending_upload" }, false);
    }
    this.queueCache.failedUploads = [];
    await this.persistQueue();
  }

  async completeUpload(claimId: string): Promise<void> {
    await this.deleteClaim(claimId);
  }

  private async persistQueue() {
    const db = await this.dbPromise;
    if (db) {
      const transaction = db.transaction(this.STORE_QUEUE, "readwrite");
      transaction.objectStore(this.STORE_QUEUE).put({
        id: `sync_queue_${this.ownerId()}`,
        data: this.queueCache,
      });
      await this.transactionComplete(transaction);
    }
    this.notifyChanged();
  }

  getTotalStorageSize(): number {
    return this.claimsCache.reduce((total, claim) => total + claim.size, 0);
  }

  getStorageInfo() {
    const totalSize = this.getTotalStorageSize();
    const queuedIds = new Set([
      ...this.queueCache.pendingUploads,
      ...this.queueCache.failedUploads,
    ]);
    const failedIds = new Set(this.queueCache.failedUploads);
    return {
      claimCount: queuedIds.size,
      maxClaims: this.MAX_CLAIMS,
      totalSize,
      maxSize: this.MAX_STORAGE_SIZE,
      usagePercentage: (totalSize / this.MAX_STORAGE_SIZE) * 100,
      pendingUploads: this.queueCache.pendingUploads.filter(
        (id) => !failedIds.has(id),
      ).length,
      failedUploads: this.queueCache.failedUploads.length,
      isIndexedDB: true,
    };
  }

  clearAll(): void {
    const offlineIds = new Set(this.claimsCache.map((claim) => claim.id));
    this.claimsCache = [];
    this.queueCache = { pendingUploads: [], failedUploads: [] };
    void this.clearIndexedDB(offlineIds);
    localStorage.removeItem(this.claimsFallbackKey());
    localStorage.removeItem(this.queueFallbackKey());
    localStorage.removeItem(this.claimsFallbackKey().replace("aivala_offline_claims_", "current_claim_draft_id_"));
    localStorage.removeItem(this.claimsFallbackKey().replace("aivala_offline_claims_", "pending_claim_draft_"));
    try {
      const claimsKey = `${"claims"}_${this.ownerId()}`;
      const claims = JSON.parse(localStorage.getItem(claimsKey) || "[]");
      localStorage.setItem(
        claimsKey,
        JSON.stringify(claims.filter((claim: any) => !offlineIds.has(claim.id))),
      );
    } catch {
      // Leave the visible claim list untouched if it cannot be parsed.
    }
    this.notifyChanged();
  }

  private async clearIndexedDB(ids: Set<string>) {
    const db = await this.dbPromise;
    if (!db) return;
    const transaction = db.transaction(
      [this.STORE_CLAIMS, this.STORE_QUEUE],
      "readwrite",
    );
    const claimStore = transaction.objectStore(this.STORE_CLAIMS);
    ids.forEach((id) => claimStore.delete(id));
    transaction.objectStore(this.STORE_QUEUE).delete(`sync_queue_${this.ownerId()}`);
    await this.transactionComplete(transaction);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export const offlineStorage = new OfflineStorageManager();
