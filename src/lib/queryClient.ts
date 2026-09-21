import { QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

export const MAX_QUERY_RETRIES = 2;

/**
 * Retry only transient failures: network errors (no response) and 5xx.
 * Never retry 4xx, and never more than MAX_QUERY_RETRIES times.
 */
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  if (isAxiosError(error)) {
    const status = error.response?.status;
    return status === undefined || status >= 500;
  }
  return false;
};

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });
