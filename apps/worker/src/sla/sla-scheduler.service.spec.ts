import { describe, expect, it, vi } from 'vitest';

import { SlaQueueService } from './sla-queue.service';
import { SlaSchedulerService } from './sla-scheduler.service';

describe('SlaSchedulerService', () => {
  it('logs and does not throw when schedule registration fails', async () => {
    const service = new SlaSchedulerService({
      ensureRepeatableSlaCheckSchedule: vi.fn().mockRejectedValue(new Error('redis unavailable')),
    } as unknown as SlaQueueService);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
