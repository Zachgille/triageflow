import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import type { AuthIdentity } from './auth.types';
import { getAuthIdentity } from './request-auth';

export const CurrentAuthIdentity = createParamDecorator((_: unknown, context: ExecutionContext): AuthIdentity => {
  const request = context.switchToHttp().getRequest<FastifyRequest>();
  const identity = getAuthIdentity(request);

  if (!identity) {
    throw new UnauthorizedException({
      status: 'error',
      code: 'UNAUTHENTICATED',
      message: 'Authentication is required.',
    });
  }

  return identity;
});
