import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);
const optionalNonEmptyString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

export const appConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_JWT_KEY: optionalNonEmptyString,
  CLERK_AUTHORIZED_PARTIES: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((party) => party.trim())
            .filter(Boolean)
        : undefined,
    ),
  CLERK_DEV_BEARER_AUTH: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optionalNonEmptyString,
  APP_BASE_URL: z.string().url(),
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  SLA_CHECK_INTERVAL_SECONDS: z.coerce.number().int().positive().max(86400).default(60),
  ANALYTICS_ROLLUP_SCHEDULE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  ANALYTICS_ROLLUP_INTERVAL_SECONDS: z.coerce.number().int().positive().max(86400).default(3600),
  ANALYTICS_ROLLUP_TENANT_BATCH_SIZE: z.coerce.number().int().positive().max(1000).default(100),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return appConfigSchema.parse(env);
}
