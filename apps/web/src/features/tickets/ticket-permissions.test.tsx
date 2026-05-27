import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TicketDetailClient } from './ticket-detail-client';
import { TicketListClient } from './ticket-list-client';
import { NewTicketClient } from './new-ticket-client';
import { WorkspaceShell } from '../workspace/workspace-shell';
import { membership, mockApi, okMe } from '../../test-utils/workspace-fixtures';
import type { ReactNode } from 'react';
import { beforeEach, vi } from 'vitest';

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

describe('permission-aware ticket UI', () => {
  beforeEach(() => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.getToken.mockResolvedValue('test-token');
  });

  it('shows ticket list read-only state and hides create access for viewers', async () => {
    mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read'],
          roleName: 'Viewer',
        }),
      ]),
      tickets: [ticket()],
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <TicketListClient tenantSlug="demo" />
      </WorkspaceShell>,
    );

    expect(await screen.findByText('Printer is offline')).toBeInTheDocument();
    expect(screen.getByText('Your current role can read this queue but cannot create, update, or assign tickets.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New ticket' })).not.toBeInTheDocument();
  });

  it('loads another cursor page into the ticket list', async () => {
    mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read'],
          roleName: 'Viewer',
        }),
      ]),
      ticketPages: {
        first: { items: [ticket({ id: 'ticket-1', subject: 'Printer is offline' })], nextCursor: 'cursor-2', hasMore: true },
        'cursor-2': { items: [ticket({ id: 'ticket-2', subject: 'VPN access failed' })], nextCursor: null, hasMore: false },
      },
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <TicketListClient tenantSlug="demo" />
      </WorkspaceShell>,
    );

    expect(await screen.findByText('Printer is offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('VPN access failed')).toBeInTheDocument();
    expect(screen.getByText('No more tickets.')).toBeInTheDocument();
  });

  it('resets ticket pagination when filters change', async () => {
    const fetchMock = mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read'],
          roleName: 'Viewer',
        }),
      ]),
      ticketPages: {
        first: { items: [ticket({ id: 'ticket-1', subject: 'Printer is offline' })], nextCursor: 'cursor-2', hasMore: true },
      },
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <TicketListClient tenantSlug="demo" />
      </WorkspaceShell>,
    );

    expect(await screen.findByText('Printer is offline')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'OPEN');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('status=OPEN'), expect.any(Object));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('cursor=cursor-2'), expect.any(Object));
  });

  it('shows create-ticket access for roles with ticket:create', async () => {
    mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read', 'ticket:create'],
          roleName: 'Agent',
        }),
      ]),
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <NewTicketClient tenantSlug="demo" />
      </WorkspaceShell>,
    );

    expect(await screen.findByRole('link', { name: 'New ticket' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create ticket' })).toBeInTheDocument();
    expect(screen.getByLabelText('Requester UUID')).toBeInTheDocument();
  });

  it('blocks create-ticket form for roles without ticket:create', async () => {
    mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read'],
          roleName: 'Viewer',
        }),
      ]),
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <NewTicketClient tenantSlug="demo" />
      </WorkspaceShell>,
    );

    expect(await screen.findByRole('heading', { name: 'Read-only access' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Requester UUID')).not.toBeInTheDocument();
  });

  it('shows update and assignment controls only when permissions allow them', async () => {
    mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read', 'ticket:update', 'ticket:assign', 'comment:create_public'],
          roleName: 'Agent',
        }),
      ]),
      comments: [publicComment()],
      ticket: ticket(),
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <TicketDetailClient tenantSlug="demo" ticketId="ticket-1" />
      </WorkspaceShell>,
    );

    expect(await screen.findByRole('button', { name: 'Update status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save assignment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add comment' })).toBeInTheDocument();
  });

  it('hides mutation controls and shows read-only message for read-only detail viewers', async () => {
    mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read'],
          roleName: 'Viewer',
        }),
      ]),
      comments: [publicComment()],
      ticket: ticket(),
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <TicketDetailClient tenantSlug="demo" ticketId="ticket-1" />
      </WorkspaceShell>,
    );

    expect(await screen.findByRole('heading', { name: 'Read-only' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save assignment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add comment' })).not.toBeInTheDocument();
  });

  it('does not offer internal note creation without comment:create_internal', async () => {
    mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read', 'comment:create_public'],
          roleName: 'Agent',
        }),
      ]),
      comments: [publicComment()],
      ticket: ticket(),
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <TicketDetailClient tenantSlug="demo" ticketId="ticket-1" />
      </WorkspaceShell>,
    );

    expect(await screen.findByRole('button', { name: 'Add comment' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Public' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Internal' })).not.toBeInTheDocument();
  });

  it('does not show internal notes when the API omits them for users without comment:read_internal', async () => {
    mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read', 'comment:create_public'],
          roleName: 'Viewer',
        }),
      ]),
      comments: [publicComment()],
      ticket: ticket(),
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <TicketDetailClient tenantSlug="demo" ticketId="ticket-1" />
      </WorkspaceShell>,
    );

    expect(await screen.findByText('Public response')).toBeInTheDocument();
    expect(screen.getByText('Internal notes are hidden for your current role.')).toBeInTheDocument();
    expect(screen.queryByText('Internal escalation note')).not.toBeInTheDocument();
  });

  it('loads the next cursor page in the comment timeline', async () => {
    mockApi({
      me: okMe([
        membership({
          permissions: ['ticket:read', 'comment:create_public'],
          roleName: 'Agent',
        }),
      ]),
      commentPages: {
        first: { items: [publicComment({ id: 'comment-1', body: 'First response' })], nextCursor: 'comment-cursor-2', hasMore: true },
        'comment-cursor-2': { items: [publicComment({ id: 'comment-2', body: 'Second response' })], nextCursor: null, hasMore: false },
      },
      ticket: ticket(),
    });

    render(
      <WorkspaceShell tenantSlug="demo">
        <TicketDetailClient tenantSlug="demo" ticketId="ticket-1" />
      </WorkspaceShell>,
    );

    expect(await screen.findByText('First response')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load newer comments' }));

    expect(await screen.findByText('Second response')).toBeInTheDocument();
  });
});

function ticket(overrides: Partial<ReturnType<typeof ticketBase>> = {}) {
  return {
    ...ticketBase(),
    ...overrides,
  };
}

function ticketBase() {
  return {
    id: 'ticket-1',
    tenantId: 'tenant-demo',
    requesterId: 'requester-1',
    assigneeUserId: null,
    status: 'OPEN',
    priority: 'NORMAL',
    subject: 'Printer is offline',
    description: 'The lobby printer is offline.',
    firstResponseDueAt: null,
    resolutionDueAt: null,
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: '2026-05-26T12:00:00.000Z',
    updatedAt: '2026-05-26T12:00:00.000Z',
  };
}

function publicComment(overrides: Partial<ReturnType<typeof publicCommentBase>> = {}) {
  return {
    ...publicCommentBase(),
    ...overrides,
  };
}

function publicCommentBase() {
  return {
    id: 'comment-1',
    tenantId: 'tenant-demo',
    ticketId: 'ticket-1',
    authorUserId: 'user-1',
    authorRequesterId: null,
    visibility: 'PUBLIC',
    body: 'Public response',
    createdAt: '2026-05-26T12:05:00.000Z',
  };
}
