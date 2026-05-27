import { AlertCircle, Loader2 } from 'lucide-react';

import { ApiClientError } from '../../lib/api-client';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-8 text-center">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof ApiClientError ? error.body.message || error.body.code : 'Something went wrong.';

  return (
    <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">Request failed</p>
        <p>{message}</p>
      </div>
    </div>
  );
}
