import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_METADATA_KEY = 'requiredPermission';

export function RequirePermission(permission: string) {
  return SetMetadata(REQUIRED_PERMISSION_METADATA_KEY, permission);
}
