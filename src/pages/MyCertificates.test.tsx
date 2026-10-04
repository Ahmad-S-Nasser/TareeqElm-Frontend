import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import MyCertificates from "./MyCertificates";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const certificate = (overrides: Record<string, unknown> = {}) => ({
  Id: "cert-1",
  Scope: "Course",
  CourseId: "c1",
  TrackId: null,
  GradeId: null,
  OrganizationId: "org-1",
  OrganizationName: "Green Valley School",
  TrainerId: "u1",
  TrainerName: "Layla Trainee",
  Title: "Algebra I",
  IssuedAt: "2026-09-20T10:00:00Z",
  VerificationCode: "Ab3_xY-9kLmNoPqRsTuVwX",
  ExamPercentage: 92,
  Manual: false,
  ...overrides,
});

const renderAt = (path: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/certificates" element={<MyCertificates />} />
      <Route path="/certificates/:certificateId" element={<MyCertificates />} />
    </Routes>,
    { initialEntries: [path] }
  );

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Trainer" });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
});
afterEach(() => mock.restore());

describe("MyCertificates", () => {
  it("lists the trainee's certificates with scope, issuer and exam score", async () => {
    mock.onGet("/certificates/me").reply(200, [
      certificate(),
      certificate({ Id: "cert-2", Scope: "Academic", Title: "Honor roll", ExamPercentage: null, Manual: true }),
    ]);
    renderAt("/certificates");

    const list = await screen.findByTestId("certificates-list");
    expect(list).toHaveTextContent("Algebra I");
    expect(list).toHaveTextContent("Honor roll");
    expect(list).toHaveTextContent("Course certificate");
    expect(list).toHaveTextContent("Academic certificate");
    expect(list).toHaveTextContent("92%");
    expect(list).toHaveTextContent("Awarded by your organization");
    expect(screen.getAllByRole("link", { name: "View & print" })[0]).toHaveAttribute("href", "/certificates/cert-1");
  });

  it("shows an empty state when there are no certificates yet", async () => {
    mock.onGet("/certificates/me").reply(200, []);
    renderAt("/certificates");

    expect(await screen.findByTestId("certificates-empty")).toHaveTextContent("No certificates yet");
  });

  it("renders one certificate for print with its public verification URL", async () => {
    mock.onGet("/certificates/me").reply(200, [certificate()]);
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();
    renderAt("/certificates/cert-1");

    expect(await screen.findByTestId("certificate-view")).toBeInTheDocument();
    expect(screen.getByTestId("certificate-trainee")).toHaveTextContent("Layla Trainee");
    expect(screen.getByTestId("certificate-title")).toHaveTextContent("Algebra I");
    expect(screen.getByTestId("certificate-exam-score")).toHaveTextContent("92%");
    expect(screen.getByTestId("certificate-verify-url")).toHaveTextContent(`${window.location.origin}/verify/Ab3_xY-9kLmNoPqRsTuVwX`);

    await user.click(screen.getByTestId("certificate-print"));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  it("says so when the certificate is not one of the caller's", async () => {
    mock.onGet("/certificates/me").reply(200, [certificate()]);
    renderAt("/certificates/someone-elses");

    expect(await screen.findByTestId("certificate-not-found")).toBeInTheDocument();
    expect(screen.queryByTestId("certificate-print")).not.toBeInTheDocument();
  });
});
