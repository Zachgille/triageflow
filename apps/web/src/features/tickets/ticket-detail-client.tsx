'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, NotebookPen, UserRound } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input, Label, Select, Textarea } from '../../components/ui/field';
import type { CommentVisibility, Ticket, TicketComment, TicketStatus } from '../../lib/api-client';
import { useWorkspaceContext } from '../workspace/workspace-context';
import { formatDate, formatEnum, shortId, ticketStatuses } from './format';
import { EmptyState, ErrorState, LoadingState } from './states';

type TicketDetailClientProps = {
  tenantSlug: string;
  ticketId: string;
};

export function TicketDetailClient({ tenantSlug, ticketId }: TicketDetailClientProps) {
  const { api, hasPermission } = useWorkspaceContext();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentsNextCursor, setCommentsNextCursor] = useState<string | null>(null);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [nextStatus, setNextStatus] = useState<TicketStatus>('OPEN');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<CommentVisibility>('PUBLIC');
  const [commentBody, setCommentBody] = useState('');

  const canUpdate = hasPermission('ticket:update');
  const canAssign = hasPermission('ticket:assign');
  const canCreatePublicComment = hasPermission('comment:create_public');
  const canCreateInternalComment = hasPermission('comment:create_internal');
  const canReadInternalComments = hasPermission('comment:read_internal');
  const isReadOnly = !canUpdate && !canAssign && !canCreatePublicComment && !canCreateInternalComment;

  const visibleStatusOptions = useMemo(() => {
    if (!ticket) {
      return ticketStatuses;
    }

    return ticketStatuses.filter((status) => status !== ticket.status);
  }, [ticket]);

  async function reload() {
    setLoading(true);
    setError(null);

    try {
      const [ticketResponse, commentsResponse] = await Promise.all([
        api.getTicket(tenantSlug, ticketId),
        api.listComments(tenantSlug, ticketId),
      ]);
      setTicket(ticketResponse);
      setComments(commentsResponse.items);
      setCommentsNextCursor(commentsResponse.nextCursor);
      setCommentsHasMore(commentsResponse.hasMore);
      setNextStatus(ticketResponse.status === 'OPEN' ? 'RESOLVED' : 'OPEN');
      setAssigneeUserId(ticketResponse.assigneeUserId ?? '');
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [tenantSlug, ticketId]);

  async function runMutation(mutation: () => Promise<unknown>, options: { reloadAfter?: boolean } = {}) {
    setBusy(true);
    setMutationError(null);

    try {
      await mutation();
      if (options.reloadAfter !== false) {
        await reload();
      }
    } catch (nextError) {
      setMutationError(nextError);
    } finally {
      setBusy(false);
    }
  }

  async function loadMoreComments() {
    if (!commentsNextCursor || commentsLoadingMore) {
      return;
    }

    setCommentsLoadingMore(true);
    setMutationError(null);

    try {
      const response = await api.listComments(tenantSlug, ticketId, { cursor: commentsNextCursor });
      setComments((current) => appendUniqueById(current, response.items));
      setCommentsNextCursor(response.nextCursor);
      setCommentsHasMore(response.hasMore);
    } catch (nextError) {
      setMutationError(nextError);
    } finally {
      setCommentsLoadingMore(false);
    }
  }

  if (loading) {
    return <LoadingState label="Loading ticket" />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!ticket) {
    return <EmptyState title="Ticket not found" detail="The backend did not return a ticket for this tenant." />;
  }

  return (
    <section className="space-y-6">
      <div>
        <Link className="text-sm text-muted-foreground hover:text-foreground" href={`/${tenantSlug}/tickets`}>
          Back to tickets
        </Link>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">{ticket.subject}</h2>
            <div className="flex flex-wrap gap-2">
              <Badge>{formatEnum(ticket.status)}</Badge>
              <Badge>{formatEnum(ticket.priority)}</Badge>
              <Badge>Created {formatDate(ticket.createdAt)}</Badge>
            </div>
          </div>
          <div className="grid gap-1 text-sm text-muted-foreground">
            <span>Requester {shortId(ticket.requesterId)}</span>
            <span>Assignee {shortId(ticket.assigneeUserId)}</span>
          </div>
        </div>
      </div>

      {mutationError ? <ErrorState error={mutationError} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">Description</h3>
            <p className="whitespace-pre-wrap rounded-md border border-border p-4 text-sm">{ticket.description}</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">Conversation</h3>
            {!canReadInternalComments ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Internal notes are hidden for your current role.
              </div>
            ) : null}
            {comments.length === 0 ? (
              <EmptyState title="No comments yet" detail="Add a public reply or internal note when permitted." />
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <article key={comment.id} className="rounded-md border border-border p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {comment.visibility === 'INTERNAL' ? (
                          <NotebookPen className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Badge>{formatEnum(comment.visibility)}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <UserRound className="h-3 w-3" />
                      {shortId(comment.authorUserId || comment.authorRequesterId)}
                    </p>
                  </article>
                ))}
                {commentsHasMore ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={commentsLoadingMore}
                      onClick={() => void loadMoreComments()}
                    >
                      {commentsLoadingMore ? 'Loading comments...' : 'Load newer comments'}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          {isReadOnly ? (
            <section className="space-y-2 rounded-md border border-border bg-muted/40 p-4">
              <h3 className="text-sm font-semibold">Read-only</h3>
              <p className="text-sm text-muted-foreground">
                Your current role can view this ticket but cannot update status, assign ownership, or add comments.
              </p>
            </section>
          ) : null}

          {canUpdate ? (
            <section className="space-y-3 rounded-md border border-border p-4">
              <h3 className="text-sm font-semibold">Status</h3>
              <Select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as TicketStatus)}>
                {visibleStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatEnum(status)}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void runMutation(() => api.transitionTicket(tenantSlug, ticket.id, nextStatus))}
              >
                Update status
              </Button>
            </section>
          ) : null}

          {canAssign ? (
            <section className="space-y-3 rounded-md border border-border p-4">
              <h3 className="text-sm font-semibold">Assignment</h3>
              <Input
                aria-label="Assignee user UUID"
                placeholder="Assignee user UUID"
                value={assigneeUserId}
                onChange={(event) => setAssigneeUserId(event.target.value)}
              />
              <Button
                type="button"
                disabled={busy}
                onClick={() => void runMutation(() => api.assignTicket(tenantSlug, ticket.id, assigneeUserId || null))}
              >
                Save assignment
              </Button>
            </section>
          ) : null}

          {canCreatePublicComment || canCreateInternalComment ? (
            <section className="space-y-3 rounded-md border border-border p-4">
              <h3 className="text-sm font-semibold">Add comment</h3>
              <div className="space-y-1">
                <Label htmlFor="comment-visibility">Visibility</Label>
                <Select
                  id="comment-visibility"
                  value={commentVisibility}
                  onChange={(event) => setCommentVisibility(event.target.value as CommentVisibility)}
                >
                  {canCreatePublicComment ? <option value="PUBLIC">Public</option> : null}
                  {canCreateInternalComment ? <option value="INTERNAL">Internal</option> : null}
                </Select>
              </div>
              <Textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} />
              <Button
                type="button"
                disabled={busy || !commentBody.trim()}
                onClick={() =>
                  void runMutation(async () => {
                    const comment = await api.createComment(tenantSlug, ticket.id, {
                      visibility: commentVisibility,
                      body: commentBody,
                    });
                    setComments((current) => appendUniqueById(current, [comment]));
                    setCommentBody('');
                  }, { reloadAfter: false })
                }
              >
                Add comment
              </Button>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function appendUniqueById<T extends { id: string }>(current: T[], next: T[]) {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}
