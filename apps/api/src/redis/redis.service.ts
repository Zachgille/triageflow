import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { AppConfigService } from '../runtime-config/app-config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(@Inject(AppConfigService) config: AppConfigService) {
    this.client = new Redis(config.values.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async checkConnection() {
    if (this.client.status !== 'ready') {
      await this.client.connect();
    }

    await this.client.ping();
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
