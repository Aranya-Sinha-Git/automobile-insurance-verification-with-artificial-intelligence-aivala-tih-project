import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { ArrowLeft, User, Mail, Phone, CreditCard, Shield } from "lucide-react";

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

            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p>{user?.phone || "Not added"}</p>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* POLICIES */}
        <Card>
          <CardContent className="p-4">

            <h3 className="mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Insurance Policies
            </h3>

            <div className="space-y-3">

              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Auto Insurance</p>
                  <p className="text-sm text-gray-500">HDFC ERGO • Policy #AUT-99824</p>
                </div>
                <span className="text-sm font-semibold text-green-600">Active</span>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* PAYMENT */}
        <Card>
          <CardContent className="p-4">

            <h3 className="mb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              Payment Methods
            </h3>

            <div className="flex justify-between items-center">
              <p>{user?.bank || "Bank Account (****6789)"}</p>

              <Button variant="outline" size="sm">
                Edit
              </Button>
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
}