export type HealthStatus = {
  status: 'ok';
  service: string;
};

export const slaQueueName = 'sla';
export const slaCheckBreachesJobName = 'check-breaches';
