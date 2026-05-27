import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { getRequestContext } from '../tenant-context/request-context';
import { REQUIRED_PERMISSION_METADATA_KEY } from './require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRED_PERMISSION_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const requestContext = getRequestContext(request);

    if (!requestContext?.permissions.includes(requiredPermission)) {
      throw new ForbiddenException({
        status: 'error',
        code: 'PERMISSION_REQUIRED',
        message: 'Required permission is missing.',
      });
    }

    return true;
  }
}
