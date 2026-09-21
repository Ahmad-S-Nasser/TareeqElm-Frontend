import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "@/i18n";
import { useFormatters } from "@/lib/format";
import { LanguageSwitcher } from "./LanguageSwitcher";

const Probe = () => {
  const { formatDate } = useFormatters();
  return <p data-testid="month">{formatDate("2025-03-09T12:00:00Z", { month: "long", timeZone: "UTC" })}</p>;
};

describe("LanguageSwitcher", () => {
  it("shows both languages in their own names and marks the active one", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button", { name: "Switch language to English" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /العربية/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles the language, <html dir> and updates the UI", async () => {
    const user = userEvent.setup();
    render(
      <>
        <LanguageSwitcher />
        <Probe />
      </>
    );
    expect(screen.getByTestId("month")).toHaveTextContent("March");

    await user.click(screen.getByRole("button", { name: /العربية/ }));
    expect(i18n.language).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("button", { name: /العربية/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group")).toHaveAttribute("aria-label", "اختيار اللغة");
    expect(screen.getByTestId("month")).toHaveTextContent("مارس");

    await user.click(screen.getByRole("button", { name: /English/ }));
    expect(document.documentElement.dir).toBe("ltr");
    expect(screen.getByTestId("month")).toHaveTextContent("March");
  });
});
