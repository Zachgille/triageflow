import { describe, expect, it } from 'vitest';

import { parseAnalyticsScheduleArgs } from './schedule-once.args';

describe('parseAnalyticsScheduleArgs', () => {
  it('parses date and limit flags for manual schedule checks', () => {
    expect(parseAnalyticsScheduleArgs(['--date', '2026-05-26', '--limit=25'])).toEqual({
      date: '2026-05-26',
      limit: 25,
    });
  });
});
