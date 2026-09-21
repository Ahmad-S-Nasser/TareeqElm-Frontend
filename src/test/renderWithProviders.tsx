import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AuthProvider, type AuthUser } from "@/hooks/useAuth";

export const TOKEN_KEY = "tareeqelm_token";
export const USER_KEY = "tareeqelm_user";
export const EXPIRY_KEY = "tareeqelm_token_expires";

export const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  Id: "user-1",
  FullName: "Test User",
  Email: "test@tareeqelm.com",
  Role: "Trainer",
  AvatarUrl: null,
  ...overrides,
});

/** Writes a signed-in session to localStorage exactly like the app does, so AuthProvider restores it on mount. */
export const seedSession = (user: AuthUser = makeUser(), opts: { token?: string; expiresAt?: string } = {}) => {
  localStorage.setItem(TOKEN_KEY, opts.token ?? "test-token");
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (opts.expiresAt) localStorage.setItem(EXPIRY_KEY, opts.expiresAt);
  return user;
};

export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

/** Renders the current router location as text so tests can assert redirects. */
export const LocationProbe = () => {
  const location = useLocation();
  return (
    <div data-testid="location" data-state={JSON.stringify(location.state ?? null)}>
      {location.pathname}
      {location.search}
    </div>
  );
};

interface ProviderOptions {
  initialEntries?: Array<string | { pathname: string; search?: string; state?: unknown }>;
  queryClient?: QueryClient;
  /** Skip the real AuthProvider (for components that do not use auth). */
  withAuth?: boolean;
}

export const renderWithProviders = (
  ui: ReactElement,
  { initialEntries = ["/"], queryClient = createTestQueryClient(), withAuth = true, ...options }: ProviderOptions &
    Omit<RenderOptions, "wrapper"> = {}
) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {withAuth ? <AuthProvider>{children}</AuthProvider> : children}
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
};
