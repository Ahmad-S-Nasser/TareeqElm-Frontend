import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MoneyInput } from "./MoneyInput";

const render = (ui: Parameters<typeof renderWithProviders>[0]) => renderWithProviders(ui, { withAuth: false });

/** Mirrors how a real form uses it: the parent owns the amount. */
function Harness({ currency = "USD", initial = null, onChange }: { currency?: string; initial?: number | null; onChange?: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <MoneyInput
        aria-label="price"
        currency={currency}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <span data-testid="value">{value === null ? "null" : String(value)}</span>
    </>
  );
}

describe("MoneyInput", () => {
  it("shows the current amount at the currency's scale", () => {
    render(<Harness initial={79} />);
    expect(screen.getByLabelText("price")).toHaveValue("79.00");
  });

  it("uses three decimals for a three-decimal currency", () => {
    render(<Harness currency="JOD" initial={1.5} />);
    expect(screen.getByLabelText("price")).toHaveValue("1.500");
  });

  it("uses no decimals for a zero-decimal currency", () => {
    render(<Harness currency="JPY" initial={1200} />);
    expect(screen.getByLabelText("price")).toHaveValue("1200");
  });

  it("reports the typed amount as a number", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("price"), "49.99");
    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("49.99"));
    expect(onChange).toHaveBeenLastCalledWith(49.99);
  });

  it("never accepts a negative amount", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("price");
    await userEvent.type(input, "-5");
    expect(input).toHaveValue("5");
    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("5"));
  });

  it("leaves a half-typed number alone while the field has focus", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("price");
    await userEvent.type(input, "0.50");
    expect(input).toHaveValue("0.50");
  });

  it("rounds to the currency's scale on blur", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("price");
    await userEvent.type(input, "1.239");
    await userEvent.tab();
    await waitFor(() => expect(input).toHaveValue("1.24"));
    expect(screen.getByTestId("value")).toHaveTextContent("1.24");
  });

  it("keeps three decimals exact on blur for a three-decimal currency", async () => {
    render(<Harness currency="JOD" />);
    const input = screen.getByLabelText("price");
    await userEvent.type(input, "0.500");
    await userEvent.tab();
    await waitFor(() => expect(input).toHaveValue("0.500"));
    expect(screen.getByTestId("value")).toHaveTextContent("0.5");
  });

  it("clears to null when emptied, so empty stays different from zero", async () => {
    render(<Harness initial={12} />);
    const input = screen.getByLabelText("price");
    await userEvent.clear(input);
    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("null"));
    await userEvent.type(input, "0");
    await userEvent.tab();
    expect(screen.getByTestId("value")).toHaveTextContent("0");
  });

  it("shows the currency code beside the field", () => {
    render(<Harness currency="SAR" initial={10} />);
    expect(screen.getByTestId("money-input")).toHaveAttribute("data-currency", "SAR");
    expect(screen.getByText("SAR")).toBeInTheDocument();
  });
});
