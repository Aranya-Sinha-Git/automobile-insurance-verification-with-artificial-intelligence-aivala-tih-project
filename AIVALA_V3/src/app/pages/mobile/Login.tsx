import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Shield, Loader2 } from "lucide-react";
import { loginWithFirebase } from "@/app/utils/firebase";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [provider, setProvider] = useState("hdfc");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      const res = await loginWithFirebase(email, password);
      if (res.success) {
        toast.success("Welcome back! Login successful.");
        navigate("/app/dashboard");
      } else {
        toast.error(res.error || "Invalid credentials. Access denied.");
      }
    } catch (err: any) {
      toast.error("Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 p-6 flex flex-col justify-center">

      <div className="mb-8 text-center text-white">
        <Shield className="h-16 w-16 mx-auto mb-4" />
        <h1 className="text-3xl mb-2">Welcome Back</h1>
        <p className="text-blue-100">Login to your AIVALA account</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Enter your credentials</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">

          <div className="space-y-2">
            <Label>Insurance Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hdfc">HDFC ERGO</SelectItem>
                <SelectItem value="icici">ICICI Lombard</SelectItem>
                <SelectItem value="sbi">SBI General</SelectItem>
                <SelectItem value="bajaj">Bajaj Allianz</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="user@example.com"
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

          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? "Authenticating..." : "Login"}
          </Button>

          <div className="text-center pt-2">
            <p className="text-sm text-gray-500">
              Don't have an account?{" "}
              <button 
                className="text-blue-600 font-medium hover:underline"
                onClick={() => navigate("/app/register")}
              >
                Sign Up
              </button>
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
