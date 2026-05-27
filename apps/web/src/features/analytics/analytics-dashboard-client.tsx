'use client';

import { useEffect, useMemo, useState } from 'react';

import type { AnalyticsDailyRollup, AnalyticsOverview } from '../../lib/api-client';
import { EmptyState, ErrorState, LoadingState } from '../tickets/states';
import { useWorkspaceContext } from '../workspace/workspace-context';

type AnalyticsDashboardClientProps = {
  tenantSlug: string;
};

export function AnalyticsDashboardClient({ tenantSlug }: AnalyticsDashboardClientProps) {
  const { api, hasPermission } = useWorkspaceContext();
  const canReadAnalytics = hasPermission('analytics:read');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [rollups, setRollups] = useState<AnalyticsDailyRollup[]>([]);
  const [loading, setLoading] = useState(canReadAnalytics);
  const [error, setError] = useState<unknown>(null);
  const range = useMemo(() => lastUtcDaysRange(14), []);

  useEffect(() => {
    let cancelled = false;

    if (!canReadAnalytics) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      api.getAnalyticsOverview(tenantSlug),
      api.getAnalyticsDailyRollups(tenantSlug, range.from, range.to),
    ])
      .then(([overviewResponse, rollupsResponse]) => {
        if (!cancelled) {
          setOverview(overviewResponse);
          setRollups(rollupsResponse.data);
        }
      })
      .catch((nextError) => {
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
  }, [api, canReadAnalytics, range.from, range.to, tenantSlug]);

  if (!canReadAnalytics) {
    return (
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold">Analytics</h2>
        <div className="rounded-md border border-border p-6">
          <h3 className="text-lg font-semibold">You do not have access to analytics</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Analytics requires the analytics:read permission. Backend authorization remains authoritative.
          </p>
        </div>
      </section>
    );
  }

  if (loading) {
    return <LoadingState label="Loading analytics" />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Workspace analytics</p>
        <h2 className="text-2xl font-semibold">Operational overview</h2>
      </div>

      {overview ? <OverviewGrid overview={overview} /> : <EmptyState title="No overview data" detail="The analytics overview did not return data." />}

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Daily rollups</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily rollups reflect generated analytics rows. Missing dates may appear empty until rollup jobs run.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Showing UTC range {range.from} to {range.to}.
          </p>
        </div>

        {rollups.length === 0 ? (
          <EmptyState
            title="No daily rollups yet"
            detail="Run the analytics rollup worker for this tenant and date range to populate rows."
          />
        ) : (
          <DailyRollupsTable rollups={rollups} />
        )}
      </div>
    </section>
  );
}

function OverviewGrid({ overview }: { overview: AnalyticsOverview }) {
  const metrics = [
    { label: 'New tickets', value: overview.newTicketCount },
    { label: 'Open tickets', value: overview.openTicketCount },
    { label: 'Pending tickets', value: overview.pendingTicketCount },
    { label: 'Resolved tickets', value: overview.resolvedTicketCount },
    { label: 'Closed tickets', value: overview.closedTicketCount },
    { label: 'Total SLA breaches', value: overview.totalSlaBreachCount },
    { label: 'Unresolved SLA breaches', value: overview.unresolvedSlaBreachCount },
    { label: 'Avg first response', value: formatDuration(overview.avgFirstResponseSeconds) },
    { label: 'Avg resolution', value: formatDuration(overview.avgResolutionSeconds) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((metric) => (
        <article key={metric.label} className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
        </article>
      ))}
    </div>
  );
}

function DailyRollupsTable({ rollups }: { rollups: AnalyticsDailyRollup[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">opened_count</th>
              <th className="px-4 py-3 font-medium">resolved_count</th>
              <th className="px-4 py-3 font-medium">closed_count</th>
              <th className="px-4 py-3 font-medium">public_comment_count</th>
              <th className="px-4 py-3 font-medium">internal_note_count</th>
              <th className="px-4 py-3 font-medium">first_response_sla_breach_count</th>
              <th className="px-4 py-3 font-medium">resolution_sla_breach_count</th>
              <th className="px-4 py-3 font-medium">avg_first_response_seconds</th>
              <th className="px-4 py-3 font-medium">avg_resolution_seconds</th>
            </tr>
          </thead>
          <tbody>
            {rollups.map((rollup) => (
              <tr key={rollup.id} className="border-t border-border">
                <td className="px-4 py-3">{formatDateOnly(rollup.date)}</td>
                <td className="px-4 py-3">{rollup.openedCount}</td>
                <td className="px-4 py-3">{rollup.resolvedCount}</td>
                <td className="px-4 py-3">{rollup.closedCount}</td>
                <td className="px-4 py-3">{rollup.publicCommentCount}</td>
                <td className="px-4 py-3">{rollup.internalNoteCount}</td>
                <td className="px-4 py-3">{rollup.firstResponseSlaBreachCount}</td>
                <td className="px-4 py-3">{rollup.resolutionSlaBreachCount}</td>
                <td className="px-4 py-3">{formatDuration(rollup.avgFirstResponseSeconds)}</td>
                <td className="px-4 py-3">{formatDuration(rollup.avgResolutionSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return 'No data yet';
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }

  return `${roundOneDecimal(seconds / 3600)}h`;
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function lastUtcDaysRange(days: number) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(today.getTime() - (days - 1) * 86_400_000);

  return {
    from: formatDateOnly(from.toISOString()),
    to: formatDateOnly(today.toISOString()),
  };
}

function formatDateOnly(value: string) {
  return value.slice(0, 10);
}
