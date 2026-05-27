import type { FastifyRequest } from 'fastify';

export type AuthIdentity = {
  provider: 'clerk';
  providerUserId: string;
  email?: string;
  displayName?: string;
};

export interface AuthIdentityProvider {
  authenticate(request: FastifyRequest): AuthIdentity | null | Promise<AuthIdentity | null>;
}

export const AUTH_IDENTITY_PROVIDER = Symbol('AUTH_IDENTITY_PROVIDER');
