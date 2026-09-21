import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { RoleGuard } from "./RoleGuard";
import { LocationProbe, makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

const renderAt = (path: string) =>
  renderWithProviders(
    <>
      <LocationProbe />
      <Routes>
        <Route path="/auth" element={<div>Sign in page</div>} />
        <Route path="/dashboard" element={<div>Trainer home</div>} />
        <Route path="/instructor" element={<div>Instructor home</div>} />
        <Route element={<RoleGuard roles={["admin"]} />}>
          <Route path="/admin" element={<div>Secret admin page</div>} />
        </Route>
        <Route element={<RoleGuard />}>
          <Route path="/profile" element={<div>Any role page</div>} />
        </Route>
      </Routes>
    </>,
    { initialEntries: [path] }
  );

describe("RoleGuard", () => {
  it("redirects signed-out users to /auth and keeps the requested location in state.from", async () => {
    renderAt("/admin?tab=users");
    expect(await screen.findByText("Sign in page")).toBeInTheDocument();
    expect(screen.queryByText("Secret admin page")).not.toBeInTheDocument();
    const state = JSON.parse(screen.getByTestId("location").getAttribute("data-state") ?? "null");
    expect(state.from.pathname).toBe("/admin");
    expect(state.from.search).toBe("?tab=users");
  });

  it("fails closed for a user with an unknown role (does not render children)", async () => {
    seedSession(makeUser({ Role: "Superuser" }));
    renderAt("/profile");
    expect(await screen.findByText("Sign in page")).toBeInTheDocument();
    expect(screen.queryByText("Any role page")).not.toBeInTheDocument();
  });

  it("fails closed when the stored user is tampered to a role-less object", async () => {
    seedSession({ ...makeUser(), Role: undefined as unknown as string });
    renderAt("/admin");
    expect(await screen.findByText("Sign in page")).toBeInTheDocument();
    expect(screen.queryByText("Secret admin page")).not.toBeInTheDocument();
  });

  it("redirects a user with the wrong role to their own home", async () => {
    seedSession(makeUser({ Role: "Instructor" }));
    renderAt("/admin");
    expect(await screen.findByText("Instructor home")).toBeInTheDocument();
    expect(screen.queryByText("Secret admin page")).not.toBeInTheDocument();
  });

  it("renders the outlet for the correct role", async () => {
    seedSession(makeUser({ Role: "Admin" }));
    renderAt("/admin");
    expect(await screen.findByText("Secret admin page")).toBeInTheDocument();
  });

  it("without a roles list, allows any signed-in user with a known role", async () => {
    seedSession(makeUser({ Role: "Trainer" }));
    renderAt("/profile");
    expect(await screen.findByText("Any role page")).toBeInTheDocument();
  });
});
