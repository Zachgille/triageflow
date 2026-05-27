import { AnalyticsDashboardClient } from '../../../features/analytics/analytics-dashboard-client';
import { WorkspaceShell } from '../../../features/workspace/workspace-shell';

export default async function AnalyticsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  return (
    <WorkspaceShell tenantSlug={tenantSlug}>
      <AnalyticsDashboardClient tenantSlug={tenantSlug} />
    </WorkspaceShell>
  );
}
