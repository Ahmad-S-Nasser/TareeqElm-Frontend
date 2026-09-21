import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LegacyUniversityRedirect } from "./LegacyUniversityRedirect";

const Where = () => {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/university" element={<LegacyUniversityRedirect />} />
        <Route path="/university/*" element={<LegacyUniversityRedirect />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe("LegacyUniversityRedirect", () => {
  it("redirects /university/dashboard to /organization/dashboard", () => {
    renderAt("/university/dashboard");
    expect(screen.getByTestId("where").textContent).toBe("/organization/dashboard");
  });

  it("redirects the bare /university path and preserves the query string", () => {
    renderAt("/university?x=1");
    expect(screen.getByTestId("where").textContent).toBe("/organization?x=1");
  });
});
