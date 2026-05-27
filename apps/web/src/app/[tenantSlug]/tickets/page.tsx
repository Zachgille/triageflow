import { TicketListClient } from '../../../features/tickets/ticket-list-client';
import { WorkspaceShell } from '../../../features/workspace/workspace-shell';

export default async function TicketsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  return (
    <WorkspaceShell tenantSlug={tenantSlug}>
      <TicketListClient tenantSlug={tenantSlug} />
    </WorkspaceShell>
  );
}
