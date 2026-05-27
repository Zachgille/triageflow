import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { membership, mockApi, okMe } from '../../test-utils/workspace-fixtures';
import { WorkspaceShell } from './workspace-shell';

const routerPush = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
  getToken: vi.fn<() => Promise<string | null>>(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => authState,
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignOutButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  UserButton: () => <button type="button">Open user menu</button>,
}));

describe('WorkspaceShell', () => {
  beforeEach(() => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.getToken.mockResolvedValue('test-token');
    routerPush.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows signed-out authentication state', async () => {
    authState.isSignedIn = false;
    mockApi({ me: null });

    render(
      <WorkspaceShell tenantSlug="demo">
        <p>Protected content</p>
      </WorkspaceShell>,
    );

    expect(await screen.findByRole('heading', { name: 'Authentication required' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('shows profile setup state for signed-in Clerk users without internal users', async () => {
    mockApi({
      me: {
        status: 'onboarding_required',
        code: 'APPLICATION_USER_NOT_FOUND',
        providerUserId: 'user_clerk',
        email: 'new@example.com',
        displayName: 'New User',
      },
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <p>Protected content</p>
      </WorkspaceShell>,
    );

    expect(await screen.findByRole('heading', { name: 'Profile setup required' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open onboarding' })).toHaveAttribute('href', '/onboarding');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('shows create-workspace state for users with no memberships', async () => {
    mockApi({ me: okMe([]) });

    render(
      <WorkspaceShell tenantSlug="demo">
        <p>Protected content</p>
      </WorkspaceShell>,
    );

    expect(await screen.findByRole('heading', { name: 'No workspaces yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create workspace' })).toHaveAttribute('href', '/onboarding');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('shows the active workspace shell for a user with membership', async () => {
    mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read', 'ticket:create', 'analytics:read'],
          roleKey: 'owner',
          roleName: 'Owner',
          tenantName: 'Demo Support',
          tenantSlug: 'demo',
        }),
      ]),
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <p>Protected content</p>
      </WorkspaceShell>,
    );

    expect(await screen.findByRole('heading', { name: 'Demo Support' })).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Pat Support')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/demo/tickets');
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute('href', '/demo/analytics');
    expect(screen.getByRole('link', { name: 'New ticket' })).toHaveAttribute('href', '/demo/tickets/new');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('hides analytics navigation without analytics:read', async () => {
    mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read'],
          tenantName: 'Demo Support',
          tenantSlug: 'demo',
        }),
      ]),
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <p>Protected content</p>
      </WorkspaceShell>,
    );

    expect(await screen.findByRole('link', { name: 'Tickets' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Analytics' })).not.toBeInTheDocument();
  });

  it('shows workspace switcher for multiple memberships', async () => {
    mockApi({
      me: okMe([
        membership({ tenantName: 'Demo Support', tenantSlug: 'demo' }),
        membership({ id: 'membership-other', tenantName: 'Other Support', tenantSlug: 'other' }),
      ]),
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <p>Protected content</p>
      </WorkspaceShell>,
    );

    const switcher = await screen.findByRole('combobox', { name: 'Switch workspace' });
    expect(screen.getByRole('option', { name: 'Demo Support' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Other Support' })).toBeInTheDocument();

    await userEvent.selectOptions(switcher, 'other');

    expect(routerPush).toHaveBeenCalledWith('/other/tickets');
  });

  it('shows unavailable workspace state for invalid tenant slug or missing membership', async () => {
    mockApi({
      me: okMe([membership({ tenantName: 'Demo Support', tenantSlug: 'demo' })]),
    });

    render(
      <WorkspaceShell tenantSlug="missing">
        <p>Protected content</p>
      </WorkspaceShell>,
    );

    expect(await screen.findByRole('heading', { name: 'Workspace unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose workspace' })).toHaveAttribute('href', '/onboarding');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
