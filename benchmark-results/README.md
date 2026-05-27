# Benchmark Results

This directory defines the local benchmark output convention.

Raw k6 summary JSON files are written to `benchmark-results/local/` by `scripts/run-k6.mjs` when running:

```powershell
corepack pnpm bench:k6:tickets
corepack pnpm bench:k6:comments
corepack pnpm bench:k6:mixed
```

Raw outputs are ignored by git by default. Promote only reviewed, summarized results into `docs/PERFORMANCE.md` or a dedicated report document when the environment, commit, seed data, and k6 settings are recorded.
