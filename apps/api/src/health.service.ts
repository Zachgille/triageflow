import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from './database/prisma.service';
import { RedisService } from './redis/redis.service';

type DependencyName = 'config' | 'database' | 'redis';
type DependencyCheck = {
  status: 'up' | 'down';
  message?: string;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getReadiness() {
    const checks: Record<DependencyName, DependencyCheck> = {
      config: { status: 'up' },
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
    };

    const ready = Object.values(checks).every((check) => check.status === 'up');

    if (!ready) {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'api',
        checks,
      });
    }

    return {
      status: 'ok',
      service: 'api',
      checks,
    };
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    try {
      await this.prisma.checkConnection();
      return { status: 'up' };
    } catch {
      return { status: 'down', message: 'Database connectivity check failed.' };
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    try {
      await this.redis.checkConnection();
      return { status: 'up' };
    } catch {
      return { status: 'down', message: 'Redis connectivity check failed.' };
    }
  }
}
