const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
const webBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

const checks = [
  { name: 'API live health', url: `${apiBaseUrl}/health/live`, expectJsonStatus: 'ok' },
  { name: 'API ready health', url: `${apiBaseUrl}/health/ready`, expectJsonStatus: 'ok' },
  { name: 'Web root', url: webBaseUrl },
  { name: 'Web onboarding', url: `${webBaseUrl}/onboarding` },
];

let failed = false;

for (const check of checks) {
  try {
    const response = await fetch(check.url);

    if (!response.ok) {
      failed = true;
      console.log(`FAIL ${check.name}: HTTP ${response.status}`);
      continue;
    }

    if (check.expectJsonStatus) {
      const body = await response.json();

      if (body.status !== check.expectJsonStatus) {
        failed = true;
        console.log(`FAIL ${check.name}: expected status ${check.expectJsonStatus}`);
        continue;
      }
    }

    console.log(`PASS ${check.name}`);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${check.name}: ${error instanceof Error ? error.message : 'request failed'}`);
  }
}

if (failed) {
  process.exitCode = 1;
}
