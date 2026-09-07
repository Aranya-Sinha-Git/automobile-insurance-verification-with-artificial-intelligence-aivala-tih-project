import { Outlet } from "react-router";

export default function MobileApp() {
  return (
    <div className="min-h-screen bg-gray-50 w-full sm:max-w-md sm:mx-auto sm:shadow-lg relative overflow-x-hidden">
      <Outlet />
    </div>
  );
}
