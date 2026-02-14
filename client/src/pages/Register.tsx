import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Loader2, UserPlus, Eye, EyeOff, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { setAuthToken, setUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function Register() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const params = new URLSearchParams(search);
  const inviteToken = params.get('invite');
  const [inviteInfo, setInviteInfo] = useState<{ role?: string; email?: string } | null>(null);

  useEffect(() => {
    if (inviteToken) {
      fetch(`/api/auth/verify-invite?token=${inviteToken}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setInviteInfo(data);
            if (data.email) setEmail(data.email);
          }
        })
        .catch(() => {});
    }
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validation
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, ...(inviteToken ? { inviteToken } : {}) }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      
      // Check if email confirmation is required
      if (!data.session) {
        // Email confirmation is enabled - show instructions
        toast({
          title: "Registration successful!",
          description: "Please check your email to confirm your account before logging in.",
          duration: 8000,
        });
        
        // Redirect to login after showing message
        setTimeout(() => {
          setLocation("/login");
        }, 2000);
        return;
      }
      
      // Store token and user info (email confirmation disabled)
      if (data.session?.access_token) {
        setAuthToken(data.session.access_token);
        
        // Fetch user details
        const userResponse = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`,
          },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData.user);
        }
      }
      
      toast({
        title: "Registration successful",
        description: "Welcome to VeriHealth!",
      });
      
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Unable to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2">
      {/* Left: Form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="flex flex-col space-y-2 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                <Activity className="h-5 w-5" />
              </div>
              <span className="font-heading font-bold text-xl tracking-tight">VeriHealth</span>
            </div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Create an account</h1>
            <p className="text-muted-foreground">Enter your information to get started with VeriHealth.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                placeholder="doctor@hospital.org" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || !!inviteInfo?.email}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="input-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input 
                  id="confirm-password" 
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="input-confirm-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-confirm-password"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              {inviteInfo ? (
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    You've been invited to join as <strong className="capitalize">{inviteInfo.role?.replace('_', ' ') || 'Patient'}</strong>.
                    Your role will be set automatically when you register.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  New accounts are created as <strong>Patient</strong> accounts. 
                  Contact an administrator if you need healthcare provider access.
                </p>
              )}
            </div>

            <Button 
              className="w-full h-11 text-base" 
              type="submit"
              disabled={isLoading}
              data-testid="button-register"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          {!inviteInfo && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={async () => {
                    const redirectUrl = `${window.location.origin}/auth/callback`;
                    await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: { redirectTo: redirectUrl },
                    });
                  }}
                  disabled={isLoading}
                  data-testid="button-google-register"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                </Button>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={async () => {
                    const redirectUrl = `${window.location.origin}/auth/callback`;
                    await supabase.auth.signInWithOAuth({
                      provider: 'facebook',
                      options: { redirectTo: redirectUrl },
                    });
                  }}
                  disabled={isLoading}
                  data-testid="button-facebook-register"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </Button>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={async () => {
                    const redirectUrl = `${window.location.origin}/auth/callback`;
                    await supabase.auth.signInWithOAuth({
                      provider: 'twitter',
                      options: { redirectTo: redirectUrl },
                    });
                  }}
                  disabled={isLoading}
                  data-testid="button-x-register"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </Button>
              </div>
            </>
          )}

          <p className="px-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a 
              href="/login" 
              className="underline underline-offset-4 hover:text-primary font-medium"
              data-testid="link-login"
            >
              Sign in
            </a>
          </p>

          <p className="px-8 text-center text-sm text-muted-foreground">
            By creating an account, you agree to our{" "}
            <a href="#" className="underline underline-offset-4 hover:text-primary">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>

      {/* Right: Visual */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/80 to-transparent"></div>
        
        <div className="relative z-10">
          <div className="inline-flex items-center rounded-full border border-sidebar-border bg-sidebar-accent/50 px-3 py-1 text-sm backdrop-blur-sm">
            <UserPlus className="mr-2 h-4 w-4 text-primary" />
            Join VeriHealth Today
          </div>
        </div>

        <div className="relative z-10 space-y-4 max-w-lg">
          <h2 className="text-3xl font-heading font-bold">
            Start monitoring health with confidence
          </h2>
          <ul className="space-y-3 text-sidebar-foreground/80">
            <li className="flex items-start gap-2">
              <Activity className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>Real-time vital signs monitoring</span>
            </li>
            <li className="flex items-start gap-2">
              <Activity className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>AI-powered risk detection</span>
            </li>
            <li className="flex items-start gap-2">
              <Activity className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>Secure and HIPAA compliant</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
