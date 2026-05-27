import { Controller, Get, Inject, NotFoundException, UseGuards } from '@nestjs/common';

import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { AppConfigService } from '../runtime-config/app-config.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { PermissionGuard } from '../rbac/permission.guard';
import { CurrentRequestContext } from '../tenant-context/current-request-context.decorator';
import type { RequestContext } from '../tenant-context/request-context';
import { TenantContextGuard } from '../tenant-context/tenant-context.guard';

@Controller('api/tenants/:tenantSlug/_debug')
@UseGuards(ClerkAuthGuard, TenantContextGuard, PermissionGuard)
export class DebugContextController {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  // Temporary guard verification endpoint. Development only.
  @Get('context')
  @RequirePermission('tenant.manage')
  getContext(@CurrentRequestContext() requestContext: RequestContext) {
    if (this.config.values.NODE_ENV === 'production') {
      throw new NotFoundException({
        status: 'error',
        code: 'DEBUG_ENDPOINT_DISABLED',
        message: 'Debug endpoint is not available.',
      });
    }

    return {
      status: 'ok',
      temporary: true,
      requestContext,
    };
  }
}
