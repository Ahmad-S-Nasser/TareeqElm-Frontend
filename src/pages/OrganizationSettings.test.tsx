import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationSettings from "./OrganizationSettings";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const platformSettings = {
  PlatformName: "TareeqElm",
  LogoUrl: null,
  Timezone: "UTC",
  DefaultLanguage: "en",
  AccentColor: "#f43f5e",
  AiEnabled: true,
  NotifyOnCompletion: true,
  NotifyOnAtRisk: false,
  UpdatedAt: null,
};

const preferences = {
  Language: null,
  Timezone: null,
  Notifications: { announcement: true, flashcards_due: true, streak_risk: true, course_completed: true, new_trainer: true, trainer_completed: true, at_risk: true },
  ShowOnLeaderboard: true,
};

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Role: "Organization", Permissions: ["settings.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Auth/me/preferences").reply(200, preferences);
  mock.onGet("/Settings").reply(200, platformSettings);
});
afterEach(() => mock.restore());

describe("OrganizationSettings", () => {
  it("has no billing tab and shows the general platform form", async () => {
    renderWithProviders(<OrganizationSettings />);
    expect(await screen.findByDisplayValue("TareeqElm")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /billing/i })).not.toBeInTheDocument();
  });

  it("PUTs platform settings from the general tab", async () => {
    mock.onPut("/Settings").reply(200, { ...platformSettings, PlatformName: "Acme" });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationSettings />);

    const nameInput = await screen.findByDisplayValue("TareeqElm");
    await user.clear(nameInput);
    await user.type(nameInput, "Acme");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => expect(mock.history.put.filter((r) => r.url === "/Settings")).toHaveLength(1));
  });

  it("switches to the notifications tab and toggles a preference", async () => {
    mock.onPut("/Auth/me/preferences").reply(200, { ...preferences, Notifications: { ...preferences.Notifications, streak_risk: false } });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationSettings />);

    await screen.findByDisplayValue("TareeqElm");
    await user.click(screen.getByRole("tab", { name: /notifications/i }));
    const toggle = await screen.findByLabelText("Streak risk alerts");
    await user.click(toggle);

    await waitFor(() => expect(mock.history.put.filter((r) => r.url === "/Auth/me/preferences")).toHaveLength(1));
  });

  it("mounts the billing profile form for users holding organization.view", async () => {
    mock.reset();
    const user = makeUser({ Role: "Organization", Permissions: ["settings.manage", "organization.view"] });
    seedSession(user);
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Auth/me/preferences").reply(200, preferences);
    mock.onGet("/Settings").reply(200, platformSettings);
    mock.onGet("/Organization/billing-profile").reply(200, { LegalName: "Acme Training LLC", BillingAddress: null, TaxId: null, TaxRatePercent: null });
    renderWithProviders(<OrganizationSettings />);

    expect(await screen.findByDisplayValue("Acme Training LLC")).toBeInTheDocument();
    expect(screen.getByTestId("billing-profile-form")).toBeInTheDocument();
  });

  it("shows an error toast when the platform settings fail to save", async () => {
    mock.onPut("/Settings").reply(500);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationSettings />);

    await screen.findByDisplayValue("TareeqElm");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
  });
});
