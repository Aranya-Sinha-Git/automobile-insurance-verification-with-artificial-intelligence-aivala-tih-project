import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Car, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { useNetworkStatus } from "@/app/utils/networkStatus";
import { Wifi, WifiOff } from "lucide-react";

export default function NewClaimType() {
  const navigate = useNavigate();
  const networkStatus = useNetworkStatus();

  const claimTypes = [
    { id: 'auto', name: 'Auto Insurance', icon: Car, bgClass: 'bg-blue-100', iconClass: 'text-blue-600', desc: 'Vehicle collision, scratch, or damage claims' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">New Claim</h1>
          <p className="text-gray-500 text-sm">Select insurance claim category</p>
        </div>
        <Badge variant={networkStatus.isOnline ? "default" : "secondary"} className="gap-1">
          {networkStatus.isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {networkStatus.isOnline ? 'Online' : 'Offline'}
        </Badge>
      </div>

      <div className="space-y-4">
        {claimTypes.map((type) => {
          const Icon = type.icon;
          return (
            <Card 
              key={type.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500"
              onClick={() => navigate("/app/video-recording")}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`${type.bgClass} p-4 rounded-xl`}>
                    <Icon className={`h-8 w-8 ${type.iconClass}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">{type.name}</h3>
                    <p className="text-sm text-gray-500">{type.desc}</p>
                    <div className="mt-3 flex items-center text-blue-600 font-medium text-sm">
                      <span>Start vehicle claim →</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Most claims are processed within 5-10 minutes using AI verification.
            {!networkStatus.isOnline && ' You can record offline - claim will upload automatically when online.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}