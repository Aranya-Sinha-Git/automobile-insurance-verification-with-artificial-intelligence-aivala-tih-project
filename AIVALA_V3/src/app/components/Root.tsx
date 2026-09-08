import { useEffect } from "react";
import { Outlet } from "react-router";
import { Toaster } from "sonner";
import { syncManager } from "@/app/utils/syncManager";
import { auth } from "@/app/utils/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { offlineStorage } from "@/app/utils/offlineStorage";

export default function Root() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      syncManager.stopAutoSync();
      delete (window as any).currentClaimVideoFile;
      delete (window as any).currentClaimThumbnail;
      void (async () => {
        await offlineStorage.setActiveOwner(user?.uid || null);
        if (user) syncManager.startAutoSync();
      })();
    });
    return () => {
      unsubscribe();
      syncManager.stopAutoSync();
      void offlineStorage.setActiveOwner(null);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-center" richColors />
      <Outlet />
    </div>
  );
}
