import { Module } from '@nestjs/common';

import { TenantContextGuard } from './tenant-context.guard';
import { TenantResolver } from './tenant-resolver.service';

@Module({
  providers: [TenantResolver, TenantContextGuard],
  exports: [TenantResolver, TenantContextGuard],
})
export class TenantContextModule {}
