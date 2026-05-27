import { Injectable } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import type { FastifyRequest } from 'fastify';

import { AppConfigService } from '../runtime-config/app-config.service';
import type { AuthIdentity, AuthIdentityProvider } from './auth.types';

@Injectable()
export class ClerkAuthIdentityProvider implements AuthIdentityProvider {
  constructor(private readonly config: AppConfigService) {}

  async authenticate(request: FastifyRequest): Promise<AuthIdentity | null> {
    const token = this.getBearerToken(request);

    if (!token) {
      return null;
    }

    if (this.config.values.NODE_ENV === 'development' && this.config.values.CLERK_DEV_BEARER_AUTH) {
      return {
        provider: 'clerk',
        providerUserId: token,
      };
    }

    try {
      const verifiedToken = await verifyToken(token, {
        secretKey: this.config.values.CLERK_SECRET_KEY,
        jwtKey: this.config.values.CLERK_JWT_KEY,
        authorizedParties: this.config.values.CLERK_AUTHORIZED_PARTIES,
      });

      if (!verifiedToken.sub) {
        return null;
      }

      const claims = verifiedToken as Record<string, unknown>;

      return {
        provider: 'clerk',
        providerUserId: verifiedToken.sub,
        ...optionalIdentityValue('email', getClaimString(claims, ['email', 'primary_email_address'])),
        ...optionalIdentityValue('displayName', getClaimString(claims, ['name', 'full_name', 'username'])),
      };
    } catch {
      return null;
    }
  }

  private getBearerToken(request: FastifyRequest) {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    const token = authorization.slice('Bearer '.length).trim();

    if (!token) {
      return null;
    }

    return token;
  }
}

function getClaimString(claims: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = claims[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function optionalIdentityValue<Key extends 'email' | 'displayName'>(key: Key, value: string | undefined) {
  return value ? { [key]: value } : {};
}
