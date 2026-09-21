import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  GraduationCap, BookOpen, Building2, Target, Flame, Brain, BarChart3,
  Sparkles, ArrowRight, ArrowLeft, Check, Rocket
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const STEPS = ["welcome", "role", "goals", "ai-setup"] as const;
type Step = typeof STEPS[number];

const learningGoals = [
  { id: "exams", label: "Prepare for exams", icon: Target, description: "Get exam-ready with practice tests and AI coaching" },
  { id: "consistency", label: "Improve study consistency", icon: Flame, description: "Build daily habits and maintain streaks" },
  { id: "subjects", label: "Learn new subjects", icon: Brain, description: "Explore courses across multiple disciplines" },
  { id: "progress", label: "Track learning progress", icon: BarChart3, description: "Monitor performance with detailed analytics" },
];

const roles = [
  { id: "applicant" as const, label: "Trainer", icon: GraduationCap, description: "Access courses, flashcards, and AI tutoring" },
  { id: "instructor" as const, label: "Instructor", icon: BookOpen, description: "Create and manage courses, track trainer progress" },
  { id: "organization" as const, label: "Organization / Admin", icon: Building2, description: "Manage departments, instructors, and analytics" },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [selectedRole, setSelectedRole] = useState<string>(role || "applicant");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [aiReady, setAiReady] = useState(false);

  const stepIndex = STEPS.indexOf(currentStep);
  const isTrainer = selectedRole === "applicant";

  const next = () => {
    if (currentStep === "welcome") setCurrentStep("role");
    else if (currentStep === "role") setCurrentStep(isTrainer ? "goals" : "ai-setup");
    else if (currentStep === "goals") setCurrentStep("ai-setup");
    else finish();
  };

  const back = () => {
    if (currentStep === "role") setCurrentStep("welcome");
    else if (currentStep === "goals") setCurrentStep("role");
    else if (currentStep === "ai-setup") setCurrentStep(isTrainer ? "goals" : "role");
  };

  const finish = () => {
    localStorage.setItem("tareeqelm_onboarding_complete", "true");
    const dest = selectedRole === "instructor" ? "/instructor" : selectedRole === "organization" ? "/organization" : "/";
    navigate(dest, { replace: true });
  };

  const toggleGoal = (id: string) =>
    setSelectedGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {STEPS.filter(s => isTrainer || s !== "goals").map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                STEPS.indexOf(s) <= stepIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>{i + 1}</div>
              {i < (isTrainer ? 3 : 2) && <div className={cn("w-12 h-0.5", STEPS.indexOf(s) < stepIndex ? "bg-primary" : "bg-border")} />}
            </div>
          ))}
        </div>

        {/* Step 1: Welcome */}
        {currentStep === "welcome" && (
          <div className="text-center space-y-6 animate-slide-up">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Rocket className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">مرحباً بك في طريق علم! 🎓</h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Welcome to <strong>TareeqElm</strong> — your AI-powered learning platform. Let's set up your personalized experience in just a few steps.
            </p>
            <Button size="lg" onClick={next} className="gap-2">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Role Selection */}
        {currentStep === "role" && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center">
              <h2 className="text-2xl font-bold">What's your role?</h2>
              <p className="text-muted-foreground mt-1">Choose how you'll use the platform</p>
            </div>
            <div className="grid gap-4">
              {roles.map(r => (
                <Card
                  key={r.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md border-2",
                    selectedRole === r.id ? "border-primary bg-primary/5" : "border-transparent"
                  )}
                  onClick={() => setSelectedRole(r.id)}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", selectedRole === r.id ? "bg-primary text-primary-foreground" : "bg-muted")}>
                      <r.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{r.label}</p>
                      <p className="text-sm text-muted-foreground">{r.description}</p>
                    </div>
                    {selectedRole === r.id && <Check className="w-5 h-5 text-primary" />}
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={back}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
              <Button onClick={next}>Continue <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </div>
        )}

        {/* Step 3: Learning Goals */}
        {currentStep === "goals" && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center">
              <h2 className="text-2xl font-bold">What are your goals?</h2>
              <p className="text-muted-foreground mt-1">Select all that apply — we'll personalize your experience</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {learningGoals.map(g => {
                const selected = selectedGoals.includes(g.id);
                return (
                  <Card
                    key={g.id}
                    className={cn("cursor-pointer transition-all hover:shadow-md border-2", selected ? "border-primary bg-primary/5" : "border-transparent")}
                    onClick={() => toggleGoal(g.id)}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", selected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        <g.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{g.label}</p>
                        <p className="text-xs text-muted-foreground">{g.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={back}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
              <Button onClick={next} disabled={selectedGoals.length === 0}>Continue <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </div>
        )}

        {/* Step 4: AI Setup */}
        {currentStep === "ai-setup" && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-2xl font-bold">Your AI Experience is Ready! ✨</h2>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Based on your preferences, we've prepared a personalized learning environment for you.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                { label: "AI Study Coach", desc: "Get personalized guidance and study strategies", done: true },
                { label: "Suggested Courses", desc: isTrainer ? "Curated courses based on your goals" : "Popular courses in your domain", done: true },
                { label: "Smart Study Schedule", desc: "AI-generated time blocks optimized for your peak hours", done: true },
                { label: "Spaced Repetition", desc: "Flashcard system with intelligent review intervals", done: true },
              ].map((item, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                      <Check className="w-4 h-4 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={back}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
              <Button size="lg" onClick={finish} className="gap-2">
                Launch My Dashboard <Rocket className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
