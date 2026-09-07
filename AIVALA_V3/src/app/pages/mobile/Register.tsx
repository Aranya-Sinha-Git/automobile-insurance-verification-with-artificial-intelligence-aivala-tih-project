import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Shield, Upload, Lock, Loader2 } from "lucide-react";
import { Checkbox } from "@/app/components/ui/checkbox";
import { registerWithFirebase } from "@/app/utils/firebase";
import { toast } from "sonner";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const canRegister = agreedToTerms && email && password && name;

  const handleRegister = async () => {
    if (!canRegister) return;
    setLoading(true);
    try {
      const res = await registerWithFirebase(email, password, name);
      if (res.success) {
        toast.success("Account created successfully!");
        navigate("/app/dashboard");
      } else {
        toast.error(res.error || "Failed to create Firebase account");
      }
    } catch (e: any) {
      toast.error("Registration failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 p-6 flex flex-col justify-center">
      <div className="mb-6 text-center text-white">
        <Shield className="h-12 w-12 mx-auto mb-3" />
        <h1 className="text-2xl font-bold">Create Account</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
          <CardDescription>Enter details to register with AIVALA & Firebase</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Upload Insurance Card</p>
            <Button variant="outline" size="sm" className="mt-2">Choose File</Button>
          </div>

          {/* Privacy Consent */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-start gap-2">
              <Checkbox 
                id="terms" 
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              />
              <label htmlFor="terms" className="text-xs text-gray-700 leading-tight cursor-pointer">
                <Lock className="h-3 w-3 inline mr-1" />
                I agree to AIVALA's privacy policy. I understand that:
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>All video data is encrypted end-to-end</li>
                  <li>Raw videos are automatically deleted after processing (within 24 hours)</li>
                  <li>Only extracted damage assessment frames are retained for claim records</li>
                  <li>I can request deletion of my data at any time</li>
                </ul>
              </label>
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={handleRegister}
            disabled={!canRegister || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}