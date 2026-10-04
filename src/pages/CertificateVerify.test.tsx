import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import i18n from "@/i18n";
import CertificateVerify from "./CertificateVerify";
import { renderWithProviders } from "@/test/renderWithProviders";

const CODE = "Ab3_xY-9kLmNoPqRsTuVwX";

// No signed-in session and no AuthProvider: the page must work for an anonymous visitor.
const renderAt = (code: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/verify/:code" element={<CertificateVerify />} />
    </Routes>,
    { initialEntries: [`/verify/${code}`], withAuth: false }
  );

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
});
afterEach(() => mock.restore());

describe("CertificateVerify", () => {
  it("shows what is printed on a valid certificate, fetched without a token", async () => {
    mock.onGet(`/certificates/verify/${CODE}`).reply(200, {
      VerificationCode: CODE,
      Scope: "Course",
      TrainerName: "Layla Trainee",
      Title: "Algebra I",
      IssuerName: "Green Valley School",
      IssuedAt: "2026-09-20T10:00:00Z",
      ExamPercentage: 84,
    });
    renderAt(CODE);

    expect(await screen.findByTestId("verify-valid")).toBeInTheDocument();
    expect(screen.getByText("Valid certificate")).toBeInTheDocument();
    expect(screen.getByTestId("verify-trainee")).toHaveTextContent("Layla Trainee");
    expect(screen.getByTestId("verify-title")).toHaveTextContent("Algebra I");
    expect(screen.getByTestId("verify-issuer")).toHaveTextContent("Green Valley School");
    expect(screen.getByTestId("verify-exam-score")).toHaveTextContent("84%");
    expect(screen.getByText("Course certificate")).toBeInTheDocument();
    expect(mock.history.get[0].headers?.Authorization).toBeUndefined();
  });

  it("falls back to the platform as issuer and hides the score when no exam was required", async () => {
    mock.onGet(`/certificates/verify/${CODE}`).reply(200, {
      VerificationCode: CODE, Scope: "Track", TrainerName: "Omar", Title: "Data Path", IssuerName: null,
      IssuedAt: "2026-09-20T10:00:00Z", ExamPercentage: null,
    });
    renderAt(CODE);

    expect(await screen.findByTestId("verify-issuer")).toHaveTextContent("TareeqElm");
    expect(screen.queryByTestId("verify-exam-score")).not.toBeInTheDocument();
  });

  it("says no certificate matches an unknown code", async () => {
    mock.onGet(`/certificates/verify/nope`).reply(404, { code: "certificate.not_found", title: "Certificate not found.", status: 404 });
    renderAt("nope");

    expect(await screen.findByTestId("verify-not-found")).toBeInTheDocument();
    expect(screen.getByText("No certificate matches this code")).toBeInTheDocument();
    expect(screen.queryByTestId("verify-valid")).not.toBeInTheDocument();
  });

  it("tells a server failure apart from a missing certificate", async () => {
    mock.onGet(`/certificates/verify/${CODE}`).reply(500);
    renderAt(CODE);

    expect(await screen.findByTestId("verify-error")).toBeInTheDocument();
    expect(screen.queryByTestId("verify-not-found")).not.toBeInTheDocument();
  });

  it("renders in Arabic", async () => {
    await i18n.changeLanguage("ar");
    mock.onGet(`/certificates/verify/${CODE}`).reply(200, {
      VerificationCode: CODE, Scope: "Academic", TrainerName: "ليلى", Title: "لوحة الشرف", IssuerName: "مدرسة الوادي",
      IssuedAt: "2026-09-20T10:00:00Z", ExamPercentage: null,
    });
    renderAt(CODE);

    expect(await screen.findByText("شهادة صالحة")).toBeInTheDocument();
    expect(screen.getByText("شهادة أكاديمية")).toBeInTheDocument();
  });
});
