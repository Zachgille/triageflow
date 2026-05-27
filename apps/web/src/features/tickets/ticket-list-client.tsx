'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Filter, Ticket as TicketIcon } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Label, Select } from '../../components/ui/field';
import type { Ticket, TicketPriority, TicketStatus } from '../../lib/api-client';
import { useWorkspaceContext } from '../workspace/workspace-context';
import { formatDate, formatEnum, shortId, ticketPriorities, ticketStatuses } from './format';
import { EmptyState, ErrorState, LoadingState } from './states';

type TicketListClientProps = {
  tenantSlug: string;
};

export function TicketListClient({ tenantSlug }: TicketListClientProps) {
  const { api, hasPermission } = useWorkspaceContext();
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [priority, setPriority] = useState<TicketPriority | ''>('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const filters = useMemo(
    () => ({
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
    }),
    [priority, status],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .listTickets(tenantSlug, filters)
      .then((response) => {
        if (!cancelled) {
          setTickets(response.items);
          setNextCursor(response.nextCursor);
          setHasMore(response.hasMore);
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setError(nextError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, filters, tenantSlug]);

  const canCreateTicket = hasPermission('ticket:create');
  const isReadOnly = !canCreateTicket && !hasPermission('ticket:update') && !hasPermission('ticket:assign');

  async function loadMoreTickets() {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const response = await api.listTickets(tenantSlug, { ...filters, cursor: nextCursor });
      setTickets((current) => appendUniqueById(current, response.items));
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Tickets</h2>
          <p className="text-sm text-muted-foreground">
            Tenant-scoped queue from the backend API.
            {isReadOnly ? ' Read-only access for your current role.' : ''}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="status-filter">Status</Label>
            <Select id="status-filter" value={status} onChange={(event) => setStatus(event.target.value as TicketStatus | '')}>
              <option value="">Any status</option>
              {ticketStatuses.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {formatEnum(candidate)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="priority-filter">Priority</Label>
            <Select
              id="priority-filter"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TicketPriority | '')}
            >
              <option value="">Any priority</option>
              {ticketPriorities.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {formatEnum(candidate)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" variant="secondary" onClick={() => { setStatus(''); setPriority(''); }}>
            <Filter className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {loading ? <LoadingState label="Loading tickets" /> : null}
      {!loading && error ? <ErrorState error={error} /> : null}
      {!loading && !error && isReadOnly ? (
        <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Your current role can read this queue but cannot create, update, or assign tickets.
        </div>
      ) : null}
      {!loading && !error && tickets.length === 0 ? (
        <EmptyState title="No tickets found" detail="Try clearing filters or create a new ticket." />
      ) : null}
      {!loading && !error && tickets.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Requester</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link className="inline-flex items-center gap-2 font-medium hover:underline" href={`/${tenantSlug}/tickets/${ticket.id}`}>
                      <TicketIcon className="h-4 w-4 text-muted-foreground" />
                      {ticket.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><Badge>{formatEnum(ticket.status)}</Badge></td>
                  <td className="px-4 py-3"><Badge>{formatEnum(ticket.priority)}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{shortId(ticket.assigneeUserId)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{shortId(ticket.requesterId)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(ticket.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {!loading && !error && tickets.length > 0 ? (
        <div className="flex justify-center">
          {hasMore ? (
            <Button type="button" variant="secondary" disabled={loadingMore} onClick={() => void loadMoreTickets()}>
              {loadingMore ? 'Loading tickets...' : 'Load more'}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">No more tickets.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function appendUniqueById<T extends { id: string }>(current: T[], next: T[]) {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}
