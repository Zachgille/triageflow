import { NewTicketClient } from '../../../../features/tickets/new-ticket-client';
import { WorkspaceShell } from '../../../../features/workspace/workspace-shell';

export default async function NewTicketPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  return (
    <WorkspaceShell tenantSlug={tenantSlug}>
      <NewTicketClient tenantSlug={tenantSlug} />
    </WorkspaceShell>
  );
}
