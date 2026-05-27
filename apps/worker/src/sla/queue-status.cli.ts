import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AnalyticsQueueModule } from '../analytics/analytics-queue.module';
import { AnalyticsQueueService } from '../analytics/analytics-queue.service';
import { AppConfigModule } from '../runtime-config/app-config.module';
import { SlaQueueModule } from './sla-queue.module';
import { SlaQueueService } from './sla-queue.service';

@Module({
  imports: [AppConfigModule, SlaQueueModule, AnalyticsQueueModule],
})
class QueueStatusCliModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(QueueStatusCliModule, {
    logger: ['error', 'warn'],
  });

  try {
    const sla = app.get(SlaQueueService);
    const analytics = app.get(AnalyticsQueueService);
    const status = {
      sla: await sla.getStatus(),
      analytics: await analytics.getStatus(),
    };
    console.log(JSON.stringify(status, null, 2));
  } finally {
    await app.close();
  }
}

void main();
