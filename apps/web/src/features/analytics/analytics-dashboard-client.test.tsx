import React from 'react';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { membership, mockApi, okMe } from '../../test-utils/workspace-fixtures';
import { WorkspaceShell } from '../workspace/workspace-shell';
import { AnalyticsDashboardClient, formatDuration } from './analytics-dashboard-client';

const authState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
  getToken: vi.fn<() => Promise<string | null>>(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => authState,
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignOutButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  UserButton: () => <button type="button">Open user menu</button>,
}));

describe('AnalyticsDashboardClient', () => {
  beforeEach(() => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.getToken.mockResolvedValue('test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders overview cards from API data', async () => {
    mockApi({
      analyticsOverview: overview(),
      analyticsRollups: [rollup()],
      me: okMe([analyticsMembership()]),
    });

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Operational overview' })).toBeInTheDocument();
    expect(screen.getByText('New tickets')).toBeInTheDocument();
    expect(screen.getByText('Open tickets')).toBeInTheDocument();
    expect(screen.getByText('Pending tickets')).toBeInTheDocument();
    expect(screen.getByText('Total SLA breaches')).toBeInTheDocument();
    expect(screen.getByText('Avg first response')).toBeInTheDocument();
    expect(screen.getByText('2m')).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('renders daily rollup rows from API data', async () => {
    mockApi({
      analyticsOverview: overview(),
      analyticsRollups: [rollup()],
      me: okMe([analyticsMembership(['ticket:read', 'analytics:read', 'comment:read_internal'])]),
    });

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Daily rollups' })).toBeInTheDocument();
    expect(screen.getByText('2026-05-26')).toBeInTheDocument();
    expect(screen.getByText('opened_count')).toBeInTheDocument();
    expect(screen.getByText('public_comment_count')).toBeInTheDocument();
    expect(screen.getByText('first_response_sla_breach_count')).toBeInTheDocument();
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
  });

  it('renders redacted internal note counts as restricted instead of zero', async () => {
    mockApi({
      analyticsOverview: overview(),
      analyticsRollups: [{ ...rollup(), internalNoteCount: undefined }],
      me: okMe([analyticsMembership()]),
    });

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Daily rollups' })).toBeInTheDocument();
    expect(screen.getByText('Restricted')).toBeInTheDocument();
  });

  it('renders null average durations as no data', async () => {
    mockApi({
      analyticsOverview: {
        ...overview(),
        avgFirstResponseSeconds: null,
        avgResolutionSeconds: null,
      },
      analyticsRollups: [
        {
          ...rollup(),
          avgFirstResponseSeconds: null,
          avgResolutionSeconds: null,
        },
      ],
      me: okMe([analyticsMembership()]),
    });

    renderDashboard();

    expect((await screen.findAllByText('No data yet')).length).toBeGreaterThanOrEqual(2);
  });

  it('shows access denied without analytics:read', async () => {
    mockApi({
      analyticsOverview: overview(),
      analyticsRollups: [rollup()],
      me: okMe([membership({ permissions: ['ticket:read'], tenantSlug: 'demo' })]),
    });

    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: 'You do not have access to analytics' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Operational overview' })).not.toBeInTheDocument();
  });

  it('renders API errors cleanly', async () => {
    mockApi({
      analyticsError: {
        status: 403,
        body: {
          status: 'error',
          code: 'PERMISSION_REQUIRED',
          message: 'Required permission is missing.',
        },
      },
      analyticsOverview: overview(),
      me: okMe([analyticsMembership()]),
    });

    renderDashboard();

    expect(await screen.findByText('Request failed')).toBeInTheDocument();
    expect(screen.getByText('Required permission is missing.')).toBeInTheDocument();
  });

  it('renders an empty state for an empty rollup range', async () => {
    mockApi({
      analyticsOverview: overview(),
      analyticsRollups: [],
      me: okMe([analyticsMembership()]),
    });

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'No daily rollups yet' })).toBeInTheDocument();
  });

  it('formats durations for seconds, minutes, hours, and nulls', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(7200)).toBe('2h');
    expect(formatDuration(null)).toBe('No data yet');
  });
});

function renderDashboard() {
  render(
    <WorkspaceShell tenantSlug="demo">
      <AnalyticsDashboardClient tenantSlug="demo" />
    </WorkspaceShell>,
  );
}

function analyticsMembership(permissions = ['ticket:read', 'analytics:read']) {
  return membership({
    permissions,
    roleKey: 'admin',
    roleName: 'Admin',
    tenantSlug: 'demo',
  });
}

function overview() {
  return {
    newTicketCount: 1,
    openTicketCount: 2,
    pendingTicketCount: 3,
    resolvedTicketCount: 4,
    closedTicketCount: 5,
    totalSlaBreachCount: 6,
    unresolvedSlaBreachCount: 7,
    avgFirstResponseSeconds: 120,
    avgResolutionSeconds: 7200,
  };
}

function rollup() {
  return {
    id: 'rollup-1',
    date: '2026-05-26T00:00:00.000Z',
    openedCount: 1,
    resolvedCount: 2,
    closedCount: 3,
    publicCommentCount: 4,
    internalNoteCount: 5,
    firstResponseSlaBreachCount: 6,
    resolutionSlaBreachCount: 7,
    avgFirstResponseSeconds: 60,
    avgResolutionSeconds: 3600,
  };
}
