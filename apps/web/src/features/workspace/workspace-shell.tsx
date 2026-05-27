'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { SignInButton, SignOutButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { LifeBuoy } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/field';
import { ErrorState, LoadingState } from '../tickets/states';
import { useWorkspaceContext, WorkspaceProvider } from './workspace-context';

type WorkspaceShellProps = {
  tenantSlug: string;
  children: ReactNode;
};

export function WorkspaceShell({ tenantSlug, children }: WorkspaceShellProps) {
  return (
    <WorkspaceProvider tenantSlug={tenantSlug}>
      <WorkspaceShellContent>{children}</WorkspaceShellContent>
    </WorkspaceProvider>
  );
}

function WorkspaceShellContent({ children }: { children: ReactNode }) {
  const router = useRouter();
  const {
    activeMembership,
    error,
    hasPermission,
    isAuthLoaded,
    isLoading,
    isSignedIn,
    me,
    memberships,
    tenantSlug,
    user,
  } = useWorkspaceContext();
  const canCreateTicket = hasPermission('ticket:create');
  const canReadAnalytics = hasPermission('analytics:read');

  function switchWorkspace(nextTenantSlug: string) {
    if (nextTenantSlug && nextTenantSlug !== tenantSlug) {
      router.push(`/${nextTenantSlug}/tickets`);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground"
              href="/onboarding"
            >
              <LifeBuoy className="h-5 w-5" />
            </Link>
            <div>
              <p className="text-sm text-muted-foreground">TriageFlow</p>
              <h1 className="text-xl font-semibold">{activeMembership?.tenant.name ?? tenantSlug}</h1>
              {activeMembership ? (
                <p className="text-sm text-muted-foreground">{activeMembership.role.name}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {!isAuthLoaded || (isSignedIn && isLoading) ? (
              <span className="text-sm text-muted-foreground">Checking workspace...</span>
            ) : null}

            {isAuthLoaded && !isSignedIn ? (
              <>
                <SignInButton mode="modal">
                  <Button>Sign in</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button variant="secondary">Sign up</Button>
                </SignUpButton>
              </>
            ) : null}

            {isAuthLoaded && isSignedIn && memberships.length > 1 ? (
              <Select
                aria-label="Switch workspace"
                className="md:w-52"
                value={activeMembership?.tenant.slug ?? ''}
                onChange={(event) => switchWorkspace(event.target.value)}
              >
                <option value="" disabled>
                  Select workspace
                </option>
                {memberships.map((membership) => (
                  <option key={membership.id} value={membership.tenant.slug}>
                    {membership.tenant.name}
                  </option>
                ))}
              </Select>
            ) : null}

            {isAuthLoaded && isSignedIn && activeMembership ? (
              <Link className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted" href={`/${tenantSlug}/tickets`}>
                Tickets
              </Link>
            ) : null}

            {isAuthLoaded && isSignedIn && activeMembership && canReadAnalytics ? (
              <Link className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted" href={`/${tenantSlug}/analytics`}>
                Analytics
              </Link>
            ) : null}

            {isAuthLoaded && isSignedIn && canCreateTicket ? (
              <Link
                className="inline-flex h-9 items-center justify-center rounded-md border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                href={`/${tenantSlug}/tickets/new`}
              >
                New ticket
              </Link>
            ) : null}

            {isAuthLoaded && isSignedIn ? (
              <div className="flex items-center gap-3">
                <div className="hidden text-right text-sm md:block">
                  <p className="font-medium">{user?.displayName ?? 'Signed in'}</p>
                  <p className="text-muted-foreground">
                    {user?.email ?? (me?.status === 'onboarding_required' ? me.email : '')}
                  </p>
                </div>
                <UserButton />
                <SignOutButton>
                  <Button variant="secondary">Sign out</Button>
                </SignOutButton>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {isAuthLoaded && !isSignedIn ? (
          <ShellMessage
            title="Authentication required"
            detail="Sign in with Clerk to load workspace tickets. Tenant membership and permissions are still enforced by the API."
          />
        ) : null}

        {isAuthLoaded && isSignedIn && isLoading ? <LoadingState label="Loading workspace" /> : null}
        {isAuthLoaded && isSignedIn && !isLoading && error ? <ErrorState error={error} /> : null}

        {isAuthLoaded && isSignedIn && !isLoading && !error && me?.status === 'onboarding_required' ? (
          <ShellMessage
            title="Profile setup required"
            detail="Complete your internal profile before accessing workspace data."
            action={<LinkButton href="/onboarding">Open onboarding</LinkButton>}
          />
        ) : null}

        {isAuthLoaded && isSignedIn && !isLoading && !error && me?.status === 'ok' && memberships.length === 0 ? (
          <ShellMessage
            title="No workspaces yet"
            detail="Create your first workspace before opening a ticket queue."
            action={<LinkButton href="/onboarding">Create workspace</LinkButton>}
          />
        ) : null}

        {isAuthLoaded &&
        isSignedIn &&
        !isLoading &&
        !error &&
        me?.status === 'ok' &&
        memberships.length > 0 &&
        !activeMembership ? (
          <ShellMessage
            title="Workspace unavailable"
            detail="Your account does not have membership in this workspace, or the workspace slug is invalid."
            action={<LinkButton href="/onboarding">Choose workspace</LinkButton>}
          />
        ) : null}

        {isAuthLoaded && isSignedIn && !isLoading && !error && activeMembership ? children : null}
      </div>
    </main>
  );
}

function ShellMessage({ action, detail, title }: { action?: ReactNode; detail: string; title: string }) {
  return (
    <div className="rounded-md border border-border p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function LinkButton({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link
      className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      href={href}
    >
      {children}
    </Link>
  );
}
