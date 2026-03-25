import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerClinician, fetchInstitutions, type Institution, type ClinicianRegistration } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Activity, Eye, EyeOff, Loader2, Stethoscope, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

const clinicianRegisterSchema = z
  .object({
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    fullName: z.string().min(2, "Full name is required"),
    licenseNumber: z.string().optional(),
    specialty: z.string().optional(),
    phone: z.string().optional(),
    institutionId: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ClinicianRegisterForm = z.infer<typeof clinicianRegisterSchema>;

function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!pw) return { level: 0, label: "", color: "" };
  const hasLength = pw.length >= 8;
  const hasNumber = /\d/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const score = (hasLength ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSymbol ? 1 : 0);
  if (score === 3) return { level: 3, label: "Strong", color: "bg-green-500" };
  if (score === 2) return { level: 2, label: "Fair", color: "bg-amber-400" };
  return { level: 1, label: "Weak", color: "bg-red-400" };
}

export function ClinicianRegister() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ClinicianRegisterForm>({
    resolver: zodResolver(clinicianRegisterSchema),
  });

  const passwordValue = watch("password") || "";
  const strength = getPasswordStrength(passwordValue);

  useEffect(() => {
    async function loadInstitutions() {
      try {
        const data = await fetchInstitutions();
        setInstitutions(data);
        if (data.length > 0) setSelectedInstitution(data[0].id);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load institutions",
          variant: "destructive",
        });
      }
    }
    loadInstitutions();
  }, [toast]);

  const onSubmit = async (data: ClinicianRegisterForm) => {
    setIsLoading(true);
    try {
      if (!selectedInstitution) {
        toast({
          title: "Institution required",
          description: "Please select an institution to continue",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const registrationData: ClinicianRegistration = {
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        licenseNumber: data.licenseNumber || undefined,
        specialty: data.specialty || undefined,
        phone: data.phone || undefined,
        institutionId: selectedInstitution,
      };

      const result = await registerClinician(registrationData);

      toast({ title: "Registration Successful", description: result.message });

      setTimeout(() => navigate("/login"), 2000);
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred during registration",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      panelFeatures={[
        "Institutional care team management",
        "Clinician-patient assignment workflows",
        "Real-time alerts and risk monitoring",
        "Secure inter-provider communication",
      ]}
      panelQuote="Trusted by clinicians across Nigeria to deliver care when and where it matters."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-400 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Activity className="h-5 w-5" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">VeriHealth</span>
          </div>
          <h1
            className="text-3xl font-heading font-bold tracking-tight text-foreground"
            data-testid="title-clinician-register"
          >
            Clinician Registration
          </h1>
          <p className="text-muted-foreground text-sm" data-testid="text-register-description">
            Register as a healthcare provider. Your account requires institution administrator approval.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fullName" className="text-sm font-medium">Full Name *</Label>
              <Input
                id="fullName"
                data-testid="input-fullName"
                {...register("fullName")}
                placeholder="Dr. Amaka Okonkwo"
                className="h-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
              />
              {errors.fullName && (
                <p className="text-xs text-red-500" data-testid="error-fullName">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email" className="text-sm font-medium">Email *</Label>
              <Input
                id="email"
                type="email"
                data-testid="input-email"
                {...register("email")}
                placeholder="doctor@hospital.ng"
                className="h-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
              />
              {errors.email && (
                <p className="text-xs text-red-500" data-testid="error-email">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  data-testid="input-password"
                  {...register("password")}
                  placeholder="Min. 6 characters"
                  className="h-12 pr-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordValue && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((s) => (
                      <div
                        key={s}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          strength.level >= s ? strength.color : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Strength:{" "}
                    <span
                      className={
                        strength.level === 3
                          ? "text-green-600 font-medium"
                          : strength.level === 2
                          ? "text-amber-600 font-medium"
                          : "text-red-500 font-medium"
                      }
                    >
                      {strength.label}
                    </span>
                  </p>
                </div>
              )}
              {errors.password && (
                <p className="text-xs text-red-500" data-testid="error-password">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  data-testid="input-confirmPassword"
                  {...register("confirmPassword")}
                  placeholder="Re-enter password"
                  className="h-12 pr-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-confirm-password"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-500" data-testid="error-confirmPassword">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="licenseNumber" className="text-sm font-medium">License Number</Label>
              <Input
                id="licenseNumber"
                data-testid="input-licenseNumber"
                {...register("licenseNumber")}
                placeholder="Optional"
                className="h-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="specialty" className="text-sm font-medium">Specialty</Label>
              <Input
                id="specialty"
                data-testid="input-specialty"
                {...register("specialty")}
                placeholder="e.g., Cardiology"
                className="h-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
              <Input
                id="phone"
                type="tel"
                data-testid="input-phone"
                {...register("phone")}
                placeholder="+234 801 234 5678"
                className="h-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="institution" className="text-sm font-medium">Institution</Label>
              <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                <SelectTrigger
                  data-testid="select-institution"
                  className="h-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
                >
                  <SelectValue placeholder="Select institution" />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => (
                    <SelectItem
                      key={inst.id}
                      value={inst.id}
                      data-testid={`option-institution-${inst.id}`}
                    >
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3.5">
            <div className="flex items-start gap-2">
              <Stethoscope className="h-4 w-4 mt-0.5 text-teal-600 flex-shrink-0" />
              <p className="text-sm text-teal-800" data-testid="text-approval-notice">
                After registration, your account will be <strong>pending approval</strong> from your
                institution administrator. You'll be able to log in once approved.
              </p>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-400 to-indigo-600 text-white hover:from-teal-500 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 rounded-xl"
            disabled={isLoading || institutions.length === 0 || !selectedInstitution}
            data-testid="button-register"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering…
              </>
            ) : (
              "Submit Registration"
            )}
          </Button>

          {institutions.length === 0 && (
            <p className="text-sm text-red-500 text-center">
              No institutions available. Please contact support.
            </p>
          )}
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <a
            href="/login"
            className="inline-flex items-center gap-1.5 font-medium text-teal-600 hover:text-indigo-600 hover:underline underline-offset-4 transition-colors"
            data-testid="button-back-to-login"
            onClick={(e) => { e.preventDefault(); navigate("/login"); }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </a>
        </p>
      </div>
    </AuthLayout>
  );
}
