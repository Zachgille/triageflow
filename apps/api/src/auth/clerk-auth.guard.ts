import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AUTH_IDENTITY_PROVIDER, type AuthIdentityProvider } from './auth.types';
import { setAuthIdentity } from './request-auth';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_IDENTITY_PROVIDER)
    private readonly identityProvider: AuthIdentityProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const identity = await this.identityProvider.authenticate(request);

    if (!identity) {
      throw new UnauthorizedException({
        status: 'error',
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      });
    }

    setAuthIdentity(request, identity);
    return true;
  }
}
