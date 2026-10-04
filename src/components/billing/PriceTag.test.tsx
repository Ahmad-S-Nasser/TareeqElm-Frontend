import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PriceTag } from "./PriceTag";
import type { PricingDto } from "@/hooks/useBilling";

const pricing = (overrides: Partial<PricingDto> = {}): PricingDto => ({
  IsFree: false,
  Amount: 79,
  EffectiveAmount: 79,
  CompareAtAmount: null,
  SaleAmount: null,
  SaleStartsAt: null,
  SaleEndsAt: null,
  Currency: "USD",
  OnSale: false,
  ...overrides,
});

const render = (ui: Parameters<typeof renderWithProviders>[0]) => renderWithProviders(ui, { withAuth: false });

describe("PriceTag", () => {
  it("renders the free label when there is no price at all", () => {
    render(<PriceTag />);
    expect(screen.getByTestId("price-tag-free")).toHaveTextContent("Free");
  });

  it("renders the free label for an explicitly free price", () => {
    render(<PriceTag pricing={pricing({ IsFree: true, Amount: 0, EffectiveAmount: 0 })} />);
    expect(screen.getByTestId("price-tag-free")).toBeInTheDocument();
  });

  it("renders nothing for a free item when showFree is off", () => {
    const { container } = render(<PriceTag showFree={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the effective amount in the price's own currency", () => {
    render(<PriceTag pricing={pricing({ Amount: 49.99, EffectiveAmount: 49.99 })} />);
    expect(screen.getByTestId("price-tag-amount")).toHaveTextContent("$49.99");
    expect(screen.queryByTestId("price-tag-compare-at")).not.toBeInTheDocument();
    expect(screen.queryByTestId("price-tag-sale")).not.toBeInTheDocument();
  });

  it("prices in the currency the DTO carries, not the platform default", () => {
    render(<PriceTag pricing={pricing({ Currency: "JOD", Amount: 12.5, EffectiveAmount: 12.5 })} currency="USD" />);
    expect(screen.getByTestId("price-tag-amount")).toHaveTextContent("12.500");
  });

  it("shows the sale price, the struck-through list price and a sale badge while on sale", () => {
    render(
      <PriceTag pricing={pricing({ Amount: 79, SaleAmount: 59, EffectiveAmount: 59, OnSale: true })} />
    );
    expect(screen.getByTestId("price-tag-amount")).toHaveTextContent("$59.00");
    const compareAt = screen.getByTestId("price-tag-compare-at");
    expect(compareAt).toHaveTextContent("$79.00");
    expect(compareAt).toHaveClass("line-through");
    expect(screen.getByTestId("price-tag-sale")).toHaveTextContent("On sale");
  });

  it("prefers an explicit compare-at price over the list price while on sale", () => {
    render(
      <PriceTag
        pricing={pricing({ Amount: 79, CompareAtAmount: 120, SaleAmount: 59, EffectiveAmount: 59, OnSale: true })}
      />
    );
    expect(screen.getByTestId("price-tag-compare-at")).toHaveTextContent("$120.00");
  });

  it("strikes through a compare-at price even when no sale window is open", () => {
    render(<PriceTag pricing={pricing({ Amount: 79, EffectiveAmount: 79, CompareAtAmount: 99 })} />);
    expect(screen.getByTestId("price-tag-compare-at")).toHaveTextContent("$99.00");
    expect(screen.queryByTestId("price-tag-sale")).not.toBeInTheDocument();
  });

  it("ignores a compare-at price that is not above the effective price", () => {
    render(<PriceTag pricing={pricing({ Amount: 79, EffectiveAmount: 79, CompareAtAmount: 79 })} />);
    expect(screen.queryByTestId("price-tag-compare-at")).not.toBeInTheDocument();
  });

  it("can hide the sale badge while keeping the struck-through price", () => {
    render(
      <PriceTag hideSaleBadge pricing={pricing({ Amount: 79, SaleAmount: 59, EffectiveAmount: 59, OnSale: true })} />
    );
    expect(screen.getByTestId("price-tag-compare-at")).toBeInTheDocument();
    expect(screen.queryByTestId("price-tag-sale")).not.toBeInTheDocument();
  });

  it("renders the owned badge instead of any price when the viewer already owns the item", () => {
    render(<PriceTag owned pricing={pricing()} />);
    expect(screen.getByTestId("price-tag-owned")).toHaveTextContent("Owned");
    expect(screen.queryByTestId("price-tag-amount")).not.toBeInTheDocument();
  });
});
