import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { getAuthModeFromRoute, getReturnPath, type AuthMode } from "@/lib/authRoute";

const PASSWORD_MIN_LENGTH = 8;

const Auth = () => {
  const { t } = useTranslation(["auth", "common", "roles"]);
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>(() => getAuthModeFromRoute(location.pathname, location.search));

  // Follow route changes (e.g. /login -> /signup) without remounting.
  useEffect(() => {
    setMode(getAuthModeFromRoute(location.pathname, location.search));
  }, [location.pathname, location.search]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateForm = () => {
    const newErrors: typeof errors = {};

    // Schemas are built here (not at module level) so messages use the language active at validation time.
    const emailSchema = z.string().email(t("auth:validation.emailInvalid"));
    const passwordSchema = z
      .string()
      .min(PASSWORD_MIN_LENGTH, t("auth:validation.passwordMin", { count: PASSWORD_MIN_LENGTH }));

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    if (mode === "signup" && !fullName.trim()) {
      newErrors.fullName = t("auth:validation.fullNameRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            variant: "destructive",
            title: t("auth:signIn.failedTitle"),
            description: error.code === "auth.invalid_credentials"
              ? t("auth:signIn.invalidCredentials")
              : error.message,
          });
          return;
        }
        toast({
          title: t("auth:signIn.successTitle"),
          description: t("auth:signIn.successDescription"),
        });
        // "/" resolves to the user's own dashboard; RoleGuard bounces disallowed targets there too.
        navigate(getReturnPath(location.state) ?? "/", { replace: true });
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast({
            variant: "destructive",
            title: t("auth:signUp.failedTitle"),
            description: error.code === "auth.registration_failed"
              ? t("auth:signUp.registrationFailed")
              : error.message,
          });
          return;
        }
        toast({
          title: t("auth:signUp.successTitle"),
          description: t("auth:signUp.successDescription"),
        });
        navigate(getReturnPath(location.state) ?? "/", { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <LanguageSwitcher className="absolute top-4 end-4" />
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow-primary mb-4">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{t("common:appName")}</h1>
          <p className="text-muted-foreground">{t("common:tagline")}</p>
        </div>

        <Card className="border-border/50 shadow-soft">
          <CardHeader className="text-center">
            <CardTitle>{mode === "signin" ? t("auth:signIn.title") : t("auth:signUp.title")}</CardTitle>
            <CardDescription>
              {mode === "signin"
                ? t("auth:signIn.subtitle")
                : t("auth:signUp.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* ── Test Accounts (sign-in only, development builds only) ── */}
              {import.meta.env.DEV && mode === "signin" && (
                <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
                    {t("auth:devLogin.title")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { role: "applicant" as const, email: "trainer@tareeqelm.com", password: "Trainer@123", icon: "👨‍🎓", color: "hover:bg-primary/10 hover:text-primary hover:border-primary/40" },
                      { role: "instructor" as const, email: "instructor@tareeqelm.com", password: "Instructor@123", icon: "👨‍🏫", color: "hover:bg-accent/10 hover:text-accent-foreground hover:border-accent/40" },
                      { role: "organization" as const, email: "organization@tareeqelm.com", password: "Organization@123", icon: "🏛️", color: "hover:bg-indigo-500/10 hover:text-indigo-600 hover:border-indigo-400/40" },
                      { role: "admin" as const, email: "admin@tareeqelm.com", password: "Admin@123", icon: "🛡️", color: "hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-400/40" },
                    ].map((acct) => (
                      <button
                        key={acct.role}
                        type="button"
                        onClick={() => {
                          setEmail(acct.email);
                          setPassword(acct.password);
                          setErrors({});
                        }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background text-sm font-medium transition-all",
                          acct.color
                        )}
                      >
                        <span>{acct.icon}</span>
                        {t(`roles:${acct.role}.name`)}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    {t("auth:devLogin.hint")}
                  </p>
                </div>
              )}

              {mode === "signup" && (
                <>
                  {/* Self-signup always creates a Trainer account.
                      Instructor, Organization and Admin accounts are provisioned by administrators. */}

                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("auth:fields.fullName.label")}</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder={t("auth:fields.fullName.placeholder")}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={errors.fullName ? "border-destructive" : ""}
                    />
                    {errors.fullName && (
                      <p className="text-xs text-destructive">{errors.fullName}</p>
                    )}
                  </div>
                </>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth:fields.email.label")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth:fields.email.placeholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth:fields.password.label")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("auth:fields.password.placeholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn("pe-10", errors.password ? "border-destructive" : "")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t("auth:fields.password.hide") : t("auth:fields.password.show")}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                variant="gradient"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    {mode === "signin" ? t("auth:signIn.submitting") : t("auth:signUp.submitting")}
                  </>
                ) : (
                  mode === "signin" ? t("auth:signIn.submit") : t("auth:signUp.submit")
                )}
              </Button>
            </form>

            {/* Toggle Mode */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {mode === "signin" ? t("auth:signIn.noAccount") : t("auth:signUp.haveAccount")}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setErrors({});
                  }}
                  className="ms-1 text-primary font-medium hover:underline"
                >
                  {mode === "signin" ? t("auth:signIn.switchToSignUp") : t("auth:signUp.switchToSignIn")}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
