import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Capabilities } from '@chatbot/shared';
import { api } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { Spinner } from '../components/Spinner';
import { Button } from '../components/Button';

const Ctx = createContext<Capabilities | null>(null);

/** The UI decides what to show from GET /api/capabilities — never from hardcoded flags. */
export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const { data, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: api.capabilities,
    staleTime: Infinity,
    retry: 1,
  });
  if (data) return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      {error ? (
        <>
          <p className="font-medium">Can't reach the API</p>
          <p className="max-w-sm text-sm text-muted">Start it with <code>pnpm dev</code>, then retry.</p>
          <Button onClick={() => void refetch()} disabled={isFetching}>Retry</Button>
        </>
      ) : (
        <Spinner />
      )}
    </div>
  );
}

export function useCapabilities(): Capabilities {
  const value = useContext(Ctx);
  if (!value) throw new Error('useCapabilities must be used inside CapabilitiesProvider');
  return value;
}
