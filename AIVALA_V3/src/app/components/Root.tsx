import { useEffect } from "react";
import { Outlet } from "react-router";
import { Toaster } from "sonner";
import { syncManager } from "@/app/utils/syncManager";
import { auth } from "@/app/utils/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function Root() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) syncManager.startAutoSync();
      else syncManager.stopAutoSync();
    });
    return () => {
      unsubscribe();
      syncManager.stopAutoSync();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" richColors />
      <Outlet />
    </div>
  );
}
