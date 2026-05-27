import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';

import type { AppConfigService } from '../runtime-config/app-config.service';
import { ClerkAuthIdentityProvider } from './clerk-auth-identity.provider';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

const verifyTokenMock = vi.mocked(verifyToken);

describe('ClerkAuthIdentityProvider', () => {
  beforeEach(() => {
    verifyTokenMock.mockReset();
  });

  it('rejects requests without a bearer token', async () => {
    const provider = new ClerkAuthIdentityProvider(createConfig());

    await expect(provider.authenticate(createRequest())).resolves.toBeNull();
  });

  it('rejects invalid Clerk tokens', async () => {
    verifyTokenMock.mockRejectedValue(new Error('invalid token'));
    const provider = new ClerkAuthIdentityProvider(createConfig());

    await expect(provider.authenticate(createRequest('bad-token'))).resolves.toBeNull();
  });

  it('maps a valid Clerk token subject to provider user id', async () => {
    verifyTokenMock.mockResolvedValue(createVerifiedToken('user_clerk_123'));
    const provider = new ClerkAuthIdentityProvider(createConfig());

    await expect(provider.authenticate(createRequest('valid-token'))).resolves.toEqual({
      provider: 'clerk',
      providerUserId: 'user_clerk_123',
    });
    expect(verifyTokenMock).toHaveBeenCalledWith('valid-token', {
      secretKey: 'sk_test_unit',
      jwtKey: undefined,
      authorizedParties: ['http://localhost:3000'],
    });
  });

  it('allows explicit development bearer fallback only in development', async () => {
    const provider = new ClerkAuthIdentityProvider(
      createConfig({ NODE_ENV: 'development', CLERK_DEV_BEARER_AUTH: true }),
    );

    await expect(provider.authenticate(createRequest('clerk_demo_admin'))).resolves.toEqual({
      provider: 'clerk',
      providerUserId: 'clerk_demo_admin',
    });
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it('does not use development bearer fallback outside development', async () => {
    verifyTokenMock.mockRejectedValue(new Error('invalid token'));
    const provider = new ClerkAuthIdentityProvider(createConfig({ NODE_ENV: 'production', CLERK_DEV_BEARER_AUTH: true }));

    await expect(provider.authenticate(createRequest('clerk_demo_admin'))).resolves.toBeNull();
    expect(verifyTokenMock).toHaveBeenCalledOnce();
  });
});

function createRequest(token?: string): FastifyRequest {
  return {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  } as FastifyRequest;
}

function createConfig(overrides: Partial<AppConfigService['values']> = {}): AppConfigService {
  return {
    values: {
      DATABASE_URL: 'postgresql://triageflow:triageflow@localhost:5432/triageflow?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      CLERK_SECRET_KEY: 'sk_test_unit',
      CLERK_JWT_KEY: undefined,
      CLERK_AUTHORIZED_PARTIES: ['http://localhost:3000'],
      CLERK_DEV_BEARER_AUTH: false,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_unit',
      APP_BASE_URL: 'http://localhost:3000',
      NODE_ENV: 'test',
      PORT: 3001,
      SLA_CHECK_INTERVAL_SECONDS: 60,
      ANALYTICS_ROLLUP_SCHEDULE_ENABLED: false,
      ANALYTICS_ROLLUP_INTERVAL_SECONDS: 3600,
      ANALYTICS_ROLLUP_TENANT_BATCH_SIZE: 100,
      ...overrides,
    },
  };
}

function createVerifiedToken(sub: string): Awaited<ReturnType<typeof verifyToken>> {
  return {
    __raw: 'raw.jwt',
    iss: 'https://example.clerk.accounts.dev',
    sid: 'sess_test',
    sub,
    nbf: 1,
    exp: 9999999999,
    iat: 1,
    v: 2,
  };
}
