import { Module } from '@nestjs/common';

import { AppConfigModule } from '../runtime-config/app-config.module';
import { AUTH_IDENTITY_PROVIDER } from './auth.types';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ClerkAuthIdentityProvider } from './clerk-auth-identity.provider';

@Module({
  imports: [AppConfigModule],
  providers: [
    ClerkAuthGuard,
    ClerkAuthIdentityProvider,
    {
      provide: AUTH_IDENTITY_PROVIDER,
      useExisting: ClerkAuthIdentityProvider,
    },
  ],
  exports: [ClerkAuthGuard, AUTH_IDENTITY_PROVIDER],
})
export class AuthModule {}
