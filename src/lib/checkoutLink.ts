import type { PurchasableItemType } from "@/hooks/useBilling";

/**
 * The one place the catalog screens build a link into the buy flow.
 *
 * `/checkout` takes the basket in the query string (`?itemType=Course&itemId=...`) rather than in router state, so a
 * "Buy" link is a real link: it survives a refresh, can be opened in a new tab and can be shared. Every purchasable
 * thing in phase 5 is addressed the same way — `Course`, `Track` or `Chapter` plus that item's id — which is exactly
 * the `CheckoutItemDto` shape the API takes, so the checkout page never has to guess what it is selling.
 */
export const checkoutHref = (itemType: PurchasableItemType, itemId: string) =>
  `/checkout?itemType=${itemType}&itemId=${encodeURIComponent(itemId)}`;

export default checkoutHref;
