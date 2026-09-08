import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { ArrowLeft, User, Mail } from "lucide-react";

export default function Profile() {
  const navigate = useNavigate();

  // ✅ SAFE USER PARSE (prevents crashes)
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-b-3xl">

        <Button
          variant="ghost"
          size="icon"
          className="text-white mb-4"
          onClick={() => navigate("/app/dashboard")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* USER INFO */}
        <div className="text-center">

          <div className="w-24 h-24 bg-white rounded-full mx-auto mb-3 flex items-center justify-center">
            <User className="h-12 w-12 text-blue-600" />
          </div>

          <h1 className="text-2xl mb-1">
            {user?.name || "Guest User"}
          </h1>

          <p className="text-blue-100">
            Customer ID: {user?.id || "Not Available"}
          </p>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-6 space-y-4">

        {/* EMAIL + PHONE */}
        <Card>
          <CardContent className="p-4 space-y-3">

            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p>{user?.email || "No email found"}</p>
              </div>
            </div>

          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 font-medium">Insurance policy</h3>
            <p className="text-sm text-gray-500">Policy details will appear here when connected to your insurer.</p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
