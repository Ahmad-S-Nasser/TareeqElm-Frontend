import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { ORDER_STATUSES } from "@/hooks/useBilling";

const render = (ui: Parameters<typeof renderWithProviders>[0]) => renderWithProviders(ui, { withAuth: false });

describe("OrderStatusBadge", () => {
  it("labels every OrderStatus from billing:orderStatus.*", () => {
    const expected: Record<(typeof ORDER_STATUSES)[number], string> = {
      PendingPayment: "Awaiting payment",
      Paid: "Paid",
      Failed: "Failed",
      Cancelled: "Cancelled",
      Refunded: "Refunded",
      PartiallyRefunded: "Partially refunded",
      Expired: "Expired",
    };
    for (const status of ORDER_STATUSES) {
      const { unmount } = render(<OrderStatusBadge status={status} />);
      expect(screen.getByTestId("order-status-badge")).toHaveTextContent(expected[status]);
      unmount();
    }
  });

  it("colours paid green, pending amber and failed destructive", () => {
    const { unmount } = render(<OrderStatusBadge status="Paid" />);
    expect(screen.getByTestId("order-status-badge").className).toContain("text-success");
    unmount();

    const pending = render(<OrderStatusBadge status="PendingPayment" />);
    expect(screen.getByTestId("order-status-badge").className).toContain("text-warning");
    pending.unmount();

    render(<OrderStatusBadge status="Failed" />);
    expect(screen.getByTestId("order-status-badge").className).toContain("text-destructive");
  });

  it("falls back to the raw value for an unknown status instead of showing a missing key", () => {
    render(<OrderStatusBadge status="SomethingNew" />);
    const badge = screen.getByTestId("order-status-badge");
    expect(badge).toHaveTextContent("SomethingNew");
    expect(badge.className).toContain("text-muted-foreground");
  });

  it("exposes the raw status as a data attribute for table filtering and tests", () => {
    render(<OrderStatusBadge status="PartiallyRefunded" />);
    expect(screen.getByTestId("order-status-badge")).toHaveAttribute("data-status", "PartiallyRefunded");
  });
});
