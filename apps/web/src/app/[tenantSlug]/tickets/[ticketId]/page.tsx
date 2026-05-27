import { TicketDetailClient } from '../../../../features/tickets/ticket-detail-client';
import { WorkspaceShell } from '../../../../features/workspace/workspace-shell';

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; ticketId: string }>;
}) {
  const { tenantSlug, ticketId } = await params;

  return (
    <WorkspaceShell tenantSlug={tenantSlug}>
      <TicketDetailClient tenantSlug={tenantSlug} ticketId={ticketId} />
    </WorkspaceShell>
  );
}
