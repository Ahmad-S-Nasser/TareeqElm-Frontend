/**
 * The buyer's own orders and receipts (plan §5.4 "Trainer self-service", permission `orders.self`).
 *
 *   GET  /api/orders/me?status=&page=&pageSize=   newest first, total in X-Total-Count
 *   GET  /api/orders/me/{id}                      one receipt
 *   POST /api/orders/me/{id}/cancel               PendingPayment only -> 204, otherwise 409 order.not_cancellable
 *
 * Self-only by construction: there is no user-id parameter anywhere here. The server scopes every read to the caller,
 * so somebody else's order id is simply "not found" and ids cannot be probed. Administrators use
 * /api/admin/orders (wave F2b), which is a different, wider shape.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { billingKeys, type MyOrderFilters, type OrderDto } from './useBilling';

export interface MyOrdersPage {
  items: OrderDto[];
  total: number;
}

export const MY_ORDERS_PAGE_SIZE = 10;

const fetchMyOrders = async (filters: MyOrderFilters): Promise<MyOrdersPage> => {
  const res = await api.get<OrderDto[]>('/orders/me', {
    params: {
      status: filters.status || undefined,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? MY_ORDERS_PAGE_SIZE,
    },
  });
  const total = Number(res.headers['x-total-count'] ?? res.data.length);
  return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
};

/** `GET /api/orders/me` — the signed-in trainer's own orders, paged and optionally filtered by status. */
export const useMyOrdersQuery = (filters: MyOrderFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.orders.me(user?.Id, filters),
    queryFn: () => fetchMyOrders(filters),
    enabled: !!user,
    // Paging a list of receipts should not blink back to a spinner.
    placeholderData: keepPreviousData,
  });
};

export interface MyOrderQueryOptions {
  /**
   * Milliseconds between refetches, or `false` to leave it alone. Checkout uses this to watch a PendingPayment order
   * until the webhook lands and flips it to Paid; nothing else should poll.
   */
  refetchInterval?: number | false;
}

/** `GET /api/orders/me/{id}` — one of the caller's own orders. A foreign or unknown id answers 404. */
export const useMyOrderQuery = (orderId?: string, { refetchInterval = false }: MyOrderQueryOptions = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.orders.detail(user?.Id, orderId),
    queryFn: async () => (await api.get<OrderDto>(`/orders/me/${orderId}`)).data,
    enabled: !!user && !!orderId,
    refetchInterval,
    retry: false,
  });
};

/**
 * `POST /api/orders/me/{id}/cancel` — closes an order that is still awaiting payment. Nothing was ever charged, so
 * this only ends the attempt; the buyer can start again at any time. A 409 (`order.not_cancellable`) means the order
 * already moved on — the list is refreshed either way.
 */
export const useCancelMyOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      await api.post(`/orders/me/${orderId}/cancel`);
      return orderId;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: billingKeys.orders.all() });
    },
  });
};
