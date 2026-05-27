export const slaQueueName = 'sla';
export const slaCheckBreachesJobName = 'check-breaches';
export const slaCheckBreachesSchedulerId = 'sla:check-breaches:every-interval';

export const slaCheckBreachesJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5_000,
  },
  removeOnComplete: {
    age: 86_400,
    count: 1_000,
  },
  removeOnFail: {
    age: 604_800,
    count: 1_000,
  },
} as const;
