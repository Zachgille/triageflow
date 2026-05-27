import { describe, expect, it } from 'vitest';

import { parseAnalyticsRollupArgs } from './rollup-daily.args';

describe('parseAnalyticsRollupArgs', () => {
  it('parses tenant and date flags for the manual analytics rollup command', () => {
    expect(parseAnalyticsRollupArgs(['--tenant', 'tenant-a', '--date', '2026-05-26'])).toEqual({
      tenantId: 'tenant-a',
      date: '2026-05-26',
    });
  });

  it('parses equals-style tenantId flags', () => {
    expect(parseAnalyticsRollupArgs(['--tenantId=tenant-a', '--now=2026-05-27T12:00:00.000Z'])).toEqual({
      tenantId: 'tenant-a',
      now: '2026-05-27T12:00:00.000Z',
    });
  });

  it('requires tenant input', () => {
    expect(() => parseAnalyticsRollupArgs(['--date', '2026-05-26'])).toThrow('worker:analytics:rollup');
  });
});
