import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Shield, Brain, Wifi } from "lucide-react";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center p-6 text-white">
      <div className="relative mb-8">
        <Shield className="h-24 w-24" />
        <Brain className="h-12 w-12 absolute -right-2 -bottom-2 text-green-400" />
      </div>
      
      <h1 className="text-4xl mb-2">AIVALA</h1>
      <p className="text-blue-100 mb-4 text-center">AI-Verified Insurance Claims</p>
      
      {/* Key Features */}
      <div className="mb-8 bg-white/10 backdrop-blur-sm rounded-lg p-4 max-w-sm">
        <div className="space-y-2 text-sm text-blue-50">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-400" />
            <span>Auto Insurance Claims</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-green-400" />
            <span>Offline Mode Available</span>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-green-400" />
            <span>5-10 Min AI Processing</span>
          </div>
        </div>
      </div>
      
      <div className="w-full max-w-sm space-y-4">
        <Button 
          className="w-full bg-white text-blue-600 hover:bg-blue-50" 
          size="lg"
          onClick={() => navigate("/app/login")}
        >
          Login
        </Button>
        <Button 
          className="w-full bg-transparent border-2 border-white hover:bg-white/10" 
          size="lg"
          onClick={() => navigate("/app/register")}
        >
          Sign Up
        </Button>
        <Button 
          variant="ghost" 
          className="w-full text-white hover:bg-white/10"
          onClick={() => navigate("/web/login")}
        >
          Insurer Login
        </Button>
      </div>
    </div>
  );
}