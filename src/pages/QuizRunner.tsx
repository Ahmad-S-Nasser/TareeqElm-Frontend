import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { getApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, AlertCircle, Clock, CheckCircle2, XCircle, Lock } from "lucide-react";
import { getHttpStatus, useQuizDetailQuery } from "@/hooks/useQuizzes";
import { QuizAttemptResult, useProgress } from "@/hooks/useProgress";
import {
  buildAnswersPayload,
  countUnanswered,
  elapsedSeconds,
  formatTimeRemaining,
  isTimeWarning,
  secondsRemaining,
} from "@/lib/quiz";

const QuizRunner = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const quizQuery = useQuizDetailQuery(quizId);
  const quiz = quizQuery.data;
  const { submitQuizAttempt } = useProgress();

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  // The hook's submit function is not referentially stable; keep the latest one in a ref.
  const submitAttemptRef = useRef(submitQuizAttempt);
  submitAttemptRef.current = submitQuizAttempt;

  const submit = useCallback(async () => {
    if (!quiz || submittedRef.current) return;
    submittedRef.current = true;
    setConfirmOpen(false);
    setSubmitting(true);
    const payload = buildAnswersPayload(quiz.Questions, answersRef.current);
    const taken = startedAtRef.current ? elapsedSeconds(startedAtRef.current, Date.now()) : undefined;
    const { result: res } = await submitAttemptRef.current(quiz.Id, payload, taken);
    if (res) setResult(res);
    else submittedRef.current = false; // failed: allow a retry (hook already showed the error)
    setSubmitting(false);
  }, [quiz]);

  // Start the clock once the quiz has loaded.
  useEffect(() => {
    if (!quiz || startedAtRef.current) return;
    startedAtRef.current = Date.now();
    if (quiz.TimeLimitMinutes) setRemaining(quiz.TimeLimitMinutes * 60);
  }, [quiz]);

  // Countdown; auto-submit at zero.
  useEffect(() => {
    if (!quiz?.TimeLimitMinutes || result) return;
    const limit = quiz.TimeLimitMinutes;
    const id = window.setInterval(() => {
      if (!startedAtRef.current) return;
      const left = secondsRemaining(limit, startedAtRef.current, Date.now());
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        void submit();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [quiz, result, submit]);

  const unanswered = useMemo(
    () => (quiz ? countUnanswered(quiz.Questions, answers) : 0),
    [quiz, answers]
  );

  const handleSubmitClick = () => {
    if (submittedRef.current) return;
    if (unanswered > 0) setConfirmOpen(true);
    else void submit();
  };

  const status = getHttpStatus(quizQuery.error);

  const renderBody = () => {
    if (quizQuery.isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24" role="status">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading quiz...</p>
        </div>
      );
    }

    if (quizQuery.error || !quiz) {
      const notEnrolled = status === 403;
      const notFound = status === 404;
      return (
        <div className="text-center py-24" role="alert">
          {notEnrolled ? (
            <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          ) : (
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          )}
          <p className="font-medium mb-1">
            {notEnrolled ? "Enroll in the course first" : notFound ? "Quiz not found" : "Could not load the quiz"}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {notEnrolled
              ? "You need to be enrolled in this course to take its quizzes."
              : notFound
                ? "This quiz does not exist or is no longer available."
                : getApiError(quizQuery.error, "Failed to load the quiz.")}
          </p>
          <div className="flex justify-center gap-2">
            {notEnrolled && <Button onClick={() => navigate("/catalog")}>Browse the catalog</Button>}
            {!notEnrolled && !notFound && (
              <Button variant="outline" onClick={() => quizQuery.refetch()}>
                Try again
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/quizzes")}>
              Back to quizzes
            </Button>
          </div>
        </div>
      );
    }

    if (result) {
      const reviewById = new Map(result.Review.map((r) => [r.QuestionId, r]));
      return (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center gap-2" role="status">
              {result.Passed ? (
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              ) : (
                <XCircle className="w-12 h-12 text-destructive" />
              )}
              <h2 className="text-2xl font-bold">{result.Passed ? "You passed!" : "Not passed this time"}</h2>
              <p className="text-4xl font-bold">{Math.round(result.Percentage)}%</p>
              <p className="text-muted-foreground">
                {result.Score} of {result.TotalPoints} points. Passing score: {quiz.PassingScore}%
              </p>
              <Badge variant={result.Passed ? "default" : "destructive"}>{result.Passed ? "Passed" : "Failed"}</Badge>
              <div className="flex gap-2 mt-3">
                <Button onClick={() => navigate("/quizzes")}>Back to quizzes</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    submittedRef.current = false;
                    startedAtRef.current = null;
                    setAnswers({});
                    setResult(null);
                    setRemaining(null);
                    void quizQuery.refetch();
                  }}
                >
                  Retake
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-3" aria-label="Review">
            <h2 className="text-xl font-semibold">Review</h2>
            {quiz.Questions.map((q, i) => {
              const r = reviewById.get(q.Id);
              const yours = r?.YourAnswer ?? null;
              return (
                <Card key={q.Id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base">
                        {i + 1}. {q.QuestionText}
                      </CardTitle>
                      <Badge variant={r?.Correct ? "default" : "destructive"}>
                        {r?.Correct ? "Correct" : yours === null ? "Unanswered" : "Incorrect"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Your answer: </span>
                      {yours === null ? "No answer" : (q.Options[yours] ?? "No answer")}
                    </p>
                    {r && !r.Correct && (
                      <p>
                        <span className="text-muted-foreground">Correct answer: </span>
                        {q.Options[r.CorrectOptionIndex]}
                      </p>
                    )}
                    {r?.Explanation && <p className="text-muted-foreground pt-1">{r.Explanation}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </section>
        </div>
      );
    }

    const warn = remaining !== null && isTimeWarning(remaining);
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{quiz.Title}</h1>
            {quiz.Description && <p className="text-muted-foreground mt-1">{quiz.Description}</p>}
            <p className="text-sm text-muted-foreground mt-1">
              {quiz.Questions.length} questions. Passing score: {quiz.PassingScore}%
            </p>
          </div>
          {remaining !== null && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-lg sticky top-20 bg-card z-10",
                warn && "border-destructive text-destructive"
              )}
            >
              <Clock className="w-5 h-5" aria-hidden="true" />
              <span aria-label="Time remaining">{formatTimeRemaining(remaining)}</span>
              {/* Announce only the warning, not every tick. */}
              <span className="sr-only" role="alert">
                {warn ? "Less than one minute remaining" : ""}
              </span>
            </div>
          )}
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitClick();
          }}
        >
          {quiz.Questions.map((q, i) => (
            <Card key={q.Id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base" id={`q-${q.Id}`}>
                  {i + 1}. {q.QuestionText}
                </CardTitle>
                <CardDescription>
                  {q.Points} point{q.Points === 1 ? "" : "s"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  aria-labelledby={`q-${q.Id}`}
                  value={answers[q.Id] !== undefined ? String(answers[q.Id]) : ""}
                  onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.Id]: Number(v) }))}
                  disabled={submitting}
                >
                  {q.Options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <RadioGroupItem value={String(oi)} id={`q-${q.Id}-${oi}`} />
                      <Label htmlFor={`q-${q.Id}-${oi}`} className="font-normal cursor-pointer">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {quiz.Questions.length - unanswered} of {quiz.Questions.length} answered
            </p>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit quiz
            </Button>
          </div>
        </form>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit with unanswered questions?</AlertDialogTitle>
              <AlertDialogDescription>
                You have {unanswered} unanswered question{unanswered === 1 ? "" : "s"}. They will be marked incorrect.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep answering</AlertDialogCancel>
              <AlertDialogAction onClick={() => void submit()}>Submit anyway</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent />} />
      <main
        className={cn(
          "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
          "ml-0"
        )}
      >
        <div className="max-w-3xl mx-auto">{renderBody()}</div>
      </main>
    </div>
  );
};

export default QuizRunner;
