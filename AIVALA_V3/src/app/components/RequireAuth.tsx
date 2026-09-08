import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { auth } from "@/app/utils/firebase";

/** Prevents direct navigation to claim and operator screens without Firebase auth. */
export default function RequireAuth({ redirectTo = "/app/login" }: { redirectTo?: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const location = useLocation();

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <div className="min-h-screen bg-gray-50" aria-busy="true" />;
  if (!user) return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function WebRequireAuth() {
  return <RequireAuth redirectTo="/web/login" />;
}
