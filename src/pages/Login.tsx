import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BackgroundLayout } from "@/components/BackgroundLayout";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, LogIn, AlertTriangle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import nslLogo from "@/assets/nsl-sugars-logo.png";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (error) {
        throw error;
      }

      if (data?.role) {
        localStorage.setItem("userRole", data.role);
      }
    } catch (error: any) {
      console.error("Profile fetch error:", error);
      if (error?.message?.toLowerCase().includes("permission")) {
        toast({
          title: "Permission Error",
          description: "Unable to read user profile. Please check Supabase RLS policies.",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      toast({
        title: "Configuration Error",
        description: "Supabase environment variables are missing. Please check .env.local file.",
        variant: "destructive",
      });
      return;
    }

    // Check if user is already logged in
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetchUserRole(session.user.id);
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Session check error:", error);
      }
    };
    checkSession();
  }, [navigate, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        await fetchUserRole(data.session.user.id);
        toast({
          title: "Login Successful",
          description: "Welcome to NSL Sugars Coupon System",
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isConfigured = isSupabaseConfigured();

  return (
    <BackgroundLayout>
      <div className="min-h-screen flex items-center justify-center p-4">
        <GlassCard className="w-full max-w-md p-8">
          <div className="flex flex-col items-center mb-8">
            <img src={nslLogo} alt="NSL Sugars" className="h-16 mb-4" />
            <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Sign in to your account
            </p>
          </div>

          {!isConfigured && (
            <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive mb-1">
                    Configuration Required
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local file and restart the server.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-background/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-background/50"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={isLoading || !isConfigured}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            NSL Sugars Coupon Management System
          </p>
        </GlassCard>
      </div>
    </BackgroundLayout>
  );
};

export default Login;
