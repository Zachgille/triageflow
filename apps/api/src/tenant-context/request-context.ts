import type { FastifyRequest } from 'fastify';

export type RequestContext = {
  requestId: string;
  userId: string;
  tenantId: string;
  membershipId: string;
  permissions: string[];
};

const REQUEST_CONTEXT_KEY = Symbol('requestContext');

type RequestWithContext = FastifyRequest & {
  [REQUEST_CONTEXT_KEY]?: RequestContext;
};

export function setRequestContext(request: FastifyRequest, requestContext: RequestContext) {
  (request as RequestWithContext)[REQUEST_CONTEXT_KEY] = requestContext;
}

export function getRequestContext(request: FastifyRequest): RequestContext | undefined {
  return (request as RequestWithContext)[REQUEST_CONTEXT_KEY];
}
