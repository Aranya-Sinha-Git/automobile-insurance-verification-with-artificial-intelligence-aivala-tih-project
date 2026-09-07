import { useEffect } from "react";
import { Outlet } from "react-router";
import { Toaster } from "sonner";
import { syncManager } from "@/app/utils/syncManager";

export default function Root() {
  useEffect(() => {
    syncManager.startAutoSync();
    return () => syncManager.stopAutoSync();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" richColors />
      <Outlet />
    </div>
  );
}
