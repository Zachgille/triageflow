import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { DebugContextController } from './debug-context.controller';

@Module({
  imports: [AuthModule, TenantContextModule, RbacModule],
  controllers: [DebugContextController],
})
export class DebugModule {}
