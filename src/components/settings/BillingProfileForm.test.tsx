import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { BillingProfileForm } from "./BillingProfileForm";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const profile = {
  LegalName: "Acme Training LLC",
  BillingAddress: "1 Tahrir Sq, Cairo",
  TaxId: "TX-998877",
  TaxRatePercent: 14,
};

let mock: MockAdapter;

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Role: "Organization", Permissions: ["organization.view", "settings.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
});
afterEach(() => mock.restore());

const lastPut = () => mock.history.put.filter((r) => r.url === "/Organization/billing-profile").pop();

describe("BillingProfileForm", () => {
  it("loads the existing billing profile into the fields", async () => {
    mock.onGet("/Organization/billing-profile").reply(200, profile);
    renderWithProviders(<BillingProfileForm canManage />);

    expect(await screen.findByDisplayValue("Acme Training LLC")).toBeInTheDocument();
    expect(screen.getByLabelText("Billing address")).toHaveValue("1 Tahrir Sq, Cairo");
    expect(screen.getByLabelText("Tax ID")).toHaveValue("TX-998877");
    expect(screen.getByLabelText("Tax rate (%)")).toHaveValue(14);
  });

  it("saves the edited profile, sending blanks as null, and toasts success", async () => {
    mock.onGet("/Organization/billing-profile").reply(200, profile);
    mock.onPut("/Organization/billing-profile").reply(200, { ...profile, LegalName: "Acme Academy LLC", TaxId: null, TaxRatePercent: null });
    const user = userEvent.setup();
    renderWithProviders(<BillingProfileForm canManage />);

    const legalName = await screen.findByDisplayValue("Acme Training LLC");
    await user.clear(legalName);
    await user.type(legalName, "Acme Academy LLC");
    await user.clear(screen.getByLabelText("Tax ID"));
    await user.clear(screen.getByLabelText("Tax rate (%)"));
    await user.click(screen.getByRole("button", { name: "Save billing profile" }));

    await waitFor(() => expect(lastPut()).toBeDefined());
    expect(JSON.parse(lastPut()!.data)).toEqual({
      LegalName: "Acme Academy LLC",
      BillingAddress: "1 Tahrir Sq, Cairo",
      TaxId: null,
      TaxRatePercent: null,
    });
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Billing profile saved." })));
  });

  it("refuses an out-of-range tax rate without calling the API", async () => {
    mock.onGet("/Organization/billing-profile").reply(200, profile);
    const user = userEvent.setup();
    renderWithProviders(<BillingProfileForm canManage />);

    const rate = await screen.findByLabelText("Tax rate (%)");
    await user.clear(rate);
    await user.type(rate, "150");
    await user.click(screen.getByRole("button", { name: "Save billing profile" }));

    expect(await screen.findByTestId("billing-tax-rate-error")).toHaveTextContent("Enter a tax rate between 0 and 100.");
    expect(lastPut()).toBeUndefined();
  });

  it("shows an error toast when the server answers 400", async () => {
    mock.onGet("/Organization/billing-profile").reply(200, profile);
    mock.onPut("/Organization/billing-profile").reply(400);
    const user = userEvent.setup();
    renderWithProviders(<BillingProfileForm canManage />);

    await screen.findByDisplayValue("Acme Training LLC");
    await user.click(screen.getByRole("button", { name: "Save billing profile" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", title: "Could not save the billing profile." })
      )
    );
  });

  it("is read-only without settings.manage", async () => {
    mock.onGet("/Organization/billing-profile").reply(200, profile);
    renderWithProviders(<BillingProfileForm canManage={false} />);

    expect(await screen.findByDisplayValue("Acme Training LLC")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save billing profile" })).not.toBeInTheDocument();
    expect(screen.getByTestId("billing-profile-readonly")).toBeInTheDocument();
  });

  it("explains when the account has no organization (204)", async () => {
    mock.onGet("/Organization/billing-profile").reply(204);
    renderWithProviders(<BillingProfileForm canManage />);

    expect(await screen.findByTestId("billing-profile-none")).toBeInTheDocument();
  });
});
