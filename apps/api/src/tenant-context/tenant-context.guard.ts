import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { setRequestContext } from './request-context';
import { TenantResolver } from './tenant-resolver.service';

type TenantParams = {
  tenantSlug?: string;
};

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(@Inject(TenantResolver) private readonly tenantResolver: TenantResolver) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest<{ Params: TenantParams }>>();
    const tenantSlug = request.params.tenantSlug;

    if (!tenantSlug) {
      return false;
    }

    const requestContext = await this.tenantResolver.resolve(request, tenantSlug);
    setRequestContext(request, requestContext);
    return true;
  }
}
