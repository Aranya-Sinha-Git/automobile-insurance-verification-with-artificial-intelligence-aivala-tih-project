import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Shield, Brain, Loader2 } from "lucide-react";
import { loginWithFirebase } from "@/app/utils/firebase";
import { toast } from "sonner";

export default function WebLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("agent");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithFirebase(email, password);
      if (res.success) {
        toast.success("Welcome to Insurer Dashboard");
        navigate("/web/dashboard");
      } else {
        toast.error(res.error || "Invalid web credentials. Access denied.");
      }
    } catch (err) {
      toast.error("Web login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 text-white">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-16 w-16" />
            <Brain className="h-12 w-12 text-green-400" />
          </div>
          <h1 className="text-4xl mb-2">AIVALA</h1>
          <p className="text-blue-200">Insurer Dashboard</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Insurer Login</CardTitle>
            <CardDescription>Access your claims management dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Claims Agent</SelectItem>
                  <SelectItem value="manager">Claims Manager</SelectItem>
                  <SelectItem value="admin">System Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email" 
                placeholder="agent@insurance.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
            </div>

            <Button className="w-full" onClick={handleSignIn} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Authenticating..." : "Sign In"}
            </Button>
          </CardContent>
        </Card>

        <div className="text-center mt-4">
          <Button variant="ghost" className="text-white" onClick={() => navigate("/")}>
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
