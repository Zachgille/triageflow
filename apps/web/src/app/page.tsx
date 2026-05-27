import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-xl space-y-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">TriageFlow</p>
        <h1 className="text-3xl font-semibold">Support desk workflow</h1>
        <p className="text-muted-foreground">
          Sign in, complete your profile, and open a workspace ticket queue.
        </p>
        <Link
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          href="/onboarding"
        >
          Continue
        </Link>
      </div>
    </main>
  );
}
