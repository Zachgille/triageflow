process.env.DATABASE_URL ??= 'postgresql://triageflow:triageflow@localhost:5432/triageflow?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.CLERK_SECRET_KEY ??= 'sk_test_placeholder';
process.env.CLERK_DEV_BEARER_AUTH ??= 'false';
process.env.CLERK_AUTHORIZED_PARTIES ??= 'http://localhost:3000';
process.env.APP_BASE_URL ??= 'http://localhost:3000';
process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3001';
