import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminSettings from "./AdminSettings";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
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
  const user = makeUser({ Role: "Admin", Permissions: ["settings.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Auth/me/preferences").reply(200, preferences);
});
afterEach(() => mock.restore());

describe("AdminSettings", () => {
  it("loads and shows the platform settings", async () => {
    mock.onGet("/Settings").reply(200, platformSettings);
    renderWithProviders(<AdminSettings />);

    expect(await screen.findByDisplayValue("TareeqElm")).toBeInTheDocument();
    expect(screen.queryByText(/billing/i)).not.toBeInTheDocument();
  });

  it("PUTs the updated platform name on save", async () => {
    mock.onGet("/Settings").reply(200, platformSettings);
    mock.onPut("/Settings").reply(200, { ...platformSettings, PlatformName: "New Name" });
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);

    const nameInput = await screen.findByDisplayValue("TareeqElm");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => expect(mock.history.put.filter((r) => r.url === "/Settings")).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toMatchObject({ PlatformName: "New Name" });
  });

  it("shows an error toast when saving fails", async () => {
    mock.onGet("/Settings").reply(200, platformSettings);
    mock.onPut("/Settings").reply(400, { code: "settings.invalid", title: "Invalid settings" });
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);

    await screen.findByDisplayValue("TareeqElm");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive", description: "Invalid settings" })));
  });

  it("toggles a notification preference", async () => {
    mock.onGet("/Settings").reply(200, platformSettings);
    mock.onPut("/Auth/me/preferences").reply(200, { ...preferences, Notifications: { ...preferences.Notifications, announcement: false } });
    const user = userEvent.setup();
    renderWithProviders(<AdminSettings />);

    const toggle = await screen.findByLabelText("Announcements");
    await user.click(toggle);

    await waitFor(() => expect(mock.history.put.filter((r) => r.url === "/Auth/me/preferences")).toHaveLength(1));
    expect(JSON.parse(mock.history.put.find((r) => r.url === "/Auth/me/preferences")!.data)).toEqual({ Notifications: { announcement: false } });
  });
});
