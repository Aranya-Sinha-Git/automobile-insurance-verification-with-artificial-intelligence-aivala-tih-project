import { Outlet } from "react-router";

export default function WebDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Outlet />
    </div>
  );
}
