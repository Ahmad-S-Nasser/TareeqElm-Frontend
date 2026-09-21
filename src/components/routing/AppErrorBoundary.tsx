import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors below it and shows a friendly fallback.
 * Use `key={location.pathname}` on the instance so it resets on navigation.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" role="alert">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10">
            <AlertTriangle className="w-7 h-7 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">
            An unexpected error occurred. You can reload the page or go back to the home page.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button variant="outline" onClick={() => window.location.assign("/")}>
              Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
