import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { getRequestContext } from './request-context';

export const CurrentRequestContext = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<FastifyRequest>();
  return getRequestContext(request);
});
