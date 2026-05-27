'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { SignInButton, SignOutButton, SignUpButton, UserButton, useAuth } from '@clerk/nextjs';
import { Building2, LifeBuoy } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/field';
import { ApiClientError, getApiBaseUrl, type MeResponse, TriageFlowApi } from '../../lib/api-client';

export function OnboardingClient() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const api = useMemo(() => new TriageFlowApi(getApiBaseUrl(), () => getToken()), [getToken]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setMe(null);
      return;
    }

    let isActive = true;
    setError(null);

    api
      .getMe()
      .then((response) => {
        if (isActive) {
          setMe(response);
        }
      })
      .catch((caught: unknown) => {
        if (isActive) {
          setError(readApiError(caught));
        }
      });

    return () => {
      isActive = false;
    };
  }, [api, isLoaded, isSignedIn]);

  async function completeProfile() {
    setIsSubmitting(true);
    setError(null);

    try {
      setMe(await api.completeProfile());
    } catch (caught) {
      setError(readApiError(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      setMe(
        await api.createTenant({
          name: workspaceName,
          slug: workspaceSlug,
        }),
      );
    } catch (caught) {
      setError(readApiError(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link className="flex items-center gap-3" href="/onboarding">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm text-muted-foreground">TriageFlow</span>
              <span className="block text-lg font-semibold">Workspace setup</span>
            </span>
          </Link>
          {isLoaded && isSignedIn ? (
            <div className="flex items-center gap-3">
              <UserButton />
              <SignOutButton>
                <Button variant="secondary">Sign out</Button>
              </SignOutButton>
            </div>
          ) : null}
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-8">
        {!isLoaded ? <Panel title="Checking session">Loading authentication state...</Panel> : null}

        {isLoaded && !isSignedIn ? (
          <Panel title="Sign in to continue">
            <p className="text-sm text-muted-foreground">
              Clerk authenticates your identity. Workspace membership and permissions are still enforced by the API.
            </p>
            <div className="mt-4 flex gap-3">
              <SignInButton mode="modal">
                <Button>Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="secondary">Sign up</Button>
              </SignUpButton>
            </div>
          </Panel>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {isLoaded && isSignedIn && me?.status === 'onboarding_required' ? (
          <Panel title="Complete profile">
            <p className="text-sm text-muted-foreground">
              Create the internal application user linked to your Clerk identity before joining or creating workspaces.
            </p>
            <Button
              className="mt-4"
              disabled={isSubmitting}
              onClick={() => {
                void completeProfile();
              }}
            >
              {isSubmitting ? 'Saving...' : 'Complete profile'}
            </Button>
          </Panel>
        ) : null}

        {isLoaded && isSignedIn && me?.status === 'ok' && me.memberships.length === 0 ? (
          <Panel title="Create workspace">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void createWorkspace(event);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input
                  id="workspace-name"
                  minLength={1}
                  maxLength={120}
                  required
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace-slug">Workspace slug</Label>
                <Input
                  id="workspace-slug"
                  minLength={3}
                  maxLength={64}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="acme-support"
                  required
                  value={workspaceSlug}
                  onChange={(event) => setWorkspaceSlug(event.target.value.toLowerCase())}
                />
              </div>
              <Button disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create workspace'}</Button>
            </form>
          </Panel>
        ) : null}

        {isLoaded && isSignedIn && me?.status === 'ok' && me.memberships.length > 0 ? (
          <Panel title="Workspaces">
            <div className="grid gap-3">
              {me.memberships.map((membership) => (
                <Link
                  className="flex items-center justify-between rounded-md border border-border p-4 hover:bg-muted"
                  href={`/${membership.tenant.slug}/tickets`}
                  key={membership.id}
                >
                  <span className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <span>
                      <span className="block font-medium">{membership.tenant.name}</span>
                      <span className="block text-sm text-muted-foreground">{membership.role.name}</span>
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">Open queue</span>
                </Link>
              ))}
            </div>
          </Panel>
        ) : null}
      </section>
    </main>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function readApiError(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.body.message || error.body.code || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Request failed.';
}
