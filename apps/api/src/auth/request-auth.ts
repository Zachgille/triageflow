import type { FastifyRequest } from 'fastify';

import type { AuthIdentity } from './auth.types';

const AUTH_IDENTITY_KEY = Symbol('authIdentity');

type RequestWithAuth = FastifyRequest & {
  [AUTH_IDENTITY_KEY]?: AuthIdentity;
};

export function setAuthIdentity(request: FastifyRequest, identity: AuthIdentity) {
  (request as RequestWithAuth)[AUTH_IDENTITY_KEY] = identity;
}

export function getAuthIdentity(request: FastifyRequest): AuthIdentity | undefined {
  return (request as RequestWithAuth)[AUTH_IDENTITY_KEY];
}
