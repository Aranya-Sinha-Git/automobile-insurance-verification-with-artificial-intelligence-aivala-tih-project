import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-orange-500 mb-4" />
        <h1 className="text-4xl mb-2">404</h1>
        <p className="text-gray-600 mb-6">Page not found</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    </div>
  );
}
