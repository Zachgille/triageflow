import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';

import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentAuthIdentity } from '../auth/current-auth-identity.decorator';
import type { AuthIdentity } from '../auth/auth.types';
import { OnboardingService } from './onboarding.service';
import { parseCreateTenantBody } from './onboarding.validation';

@Controller('api')
@UseGuards(ClerkAuthGuard)
export class OnboardingController {
  constructor(@Inject(OnboardingService) private readonly onboarding: OnboardingService) {}

  @Get('me')
  getCurrentUser(@CurrentAuthIdentity() identity: AuthIdentity) {
    return this.onboarding.getCurrentUser(identity);
  }

  @Post('onboarding/profile')
  completeProfile(@CurrentAuthIdentity() identity: AuthIdentity) {
    return this.onboarding.completeProfile(identity);
  }

  @Post('onboarding/tenant')
  createTenant(@CurrentAuthIdentity() identity: AuthIdentity, @Body() body: unknown) {
    return this.onboarding.createTenant(identity, parseCreateTenantBody(body));
  }
}
