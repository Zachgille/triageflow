'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';

import { getApiBaseUrl, type MeMembership, type MeResponse, TriageFlowApi } from '../../lib/api-client';

type WorkspaceContextValue = {
  api: TriageFlowApi;
  isAuthLoaded: boolean;
  isSignedIn: boolean | undefined;
  isLoading: boolean;
  error: unknown;
  me: MeResponse | null;
  user: Extract<MeResponse, { status: 'ok' }>['user'] | null;
  memberships: MeMembership[];
  activeMembership: MeMembership | null;
  activePermissions: string[];
  hasPermission: (permission: string) => boolean;
  tenantSlug: string;
  reloadCurrentUser: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children, tenantSlug }: { children: ReactNode; tenantSlug: string }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const api = useMemo(() => new TriageFlowApi(getApiBaseUrl(), () => getToken()), [getToken]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  async function reloadCurrentUser() {
    if (!isLoaded || !isSignedIn) {
      setMe(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setMe(await api.getMe());
    } catch (nextError) {
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reloadCurrentUser();
  }, [api, isLoaded, isSignedIn]);

  const okResponse = me?.status === 'ok' ? me : null;
  const memberships = okResponse?.memberships ?? [];
  const activeMembership =
    memberships.find((membership) => membership.tenant.slug === tenantSlug) ??
    memberships.find((membership) => membership.tenant.id === tenantSlug) ??
    null;
  const activePermissions = activeMembership?.permissions ?? [];

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      api,
      isAuthLoaded: isLoaded,
      isSignedIn,
      isLoading,
      error,
      me,
      user: okResponse?.user ?? null,
      memberships,
      activeMembership,
      activePermissions,
      hasPermission(permission: string) {
        return activePermissions.includes(permission);
      },
      tenantSlug,
      reloadCurrentUser,
    }),
    [activeMembership, activePermissions, api, error, isLoaded, isLoading, isSignedIn, me, memberships, okResponse?.user, tenantSlug],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspaceContext must be used inside WorkspaceProvider.');
  }

  return context;
}
