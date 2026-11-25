import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,          // 30 s — balance freshness vs. requests
      refetchOnWindowFocus: false, // Avoid surprising refetches in a local app
    },
    mutations: {
      onError: (err) => {
        console.error('[mutation error]', err);
      },
    },
  },
});
