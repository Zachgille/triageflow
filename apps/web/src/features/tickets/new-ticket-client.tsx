'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '../../components/ui/button';
import { Label, Input, Select, Textarea } from '../../components/ui/field';
import type { TicketPriority } from '../../lib/api-client';
import { useWorkspaceContext } from '../workspace/workspace-context';
import { formatEnum, ticketPriorities } from './format';
import { ErrorState } from './states';

export function NewTicketClient({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const { api, hasPermission } = useWorkspaceContext();
  const [requesterId, setRequesterId] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('NORMAL');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const ticket = await api.createTicket(tenantSlug, {
        requesterId,
        priority,
        subject,
        description,
      });
      router.push(`/${tenantSlug}/tickets/${ticket.id}`);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasPermission('ticket:create')) {
    return (
      <section className="max-w-3xl space-y-5">
        <Link className="text-sm text-muted-foreground hover:text-foreground" href={`/${tenantSlug}/tickets`}>
          Back to tickets
        </Link>
        <div className="rounded-md border border-border p-6">
          <h2 className="text-lg font-semibold">Read-only access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your current role does not include permission to create tickets in this workspace.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-3xl space-y-5">
      <div>
        <Link className="text-sm text-muted-foreground hover:text-foreground" href={`/${tenantSlug}/tickets`}>
          Back to tickets
        </Link>
        <h2 className="mt-2 text-2xl font-semibold">Create ticket</h2>
      </div>
      {error ? <ErrorState error={error} /> : null}
      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <div className="space-y-1">
          <Label htmlFor="requester-id">Requester UUID</Label>
          <Input id="requester-id" value={requesterId} onChange={(event) => setRequesterId(event.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)}>
            {ticketPriorities.map((candidate) => (
              <option key={candidate} value={candidate}>{formatEnum(candidate)}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} required />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create ticket'}</Button>
          <Link className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm" href={`/${tenantSlug}/tickets`}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
