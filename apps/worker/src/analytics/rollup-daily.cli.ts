import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppConfigModule } from '../runtime-config/app-config.module';
import { AnalyticsQueueModule } from './analytics-queue.module';
import { analyticsQueueName, analyticsRollupDailyJobName } from './analytics-queue.constants';
import { AnalyticsQueueService } from './analytics-queue.service';
import { parseAnalyticsRollupArgs } from './rollup-daily.args';

@Module({
  imports: [AppConfigModule, AnalyticsQueueModule],
})
class AnalyticsRollupCliModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(AnalyticsRollupCliModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const data = parseAnalyticsRollupArgs(process.argv.slice(2));
    const queue = app.get(AnalyticsQueueService);
    const job = await queue.enqueueDailyRollup(data);
    console.log(
      JSON.stringify(
        {
          queue: analyticsQueueName,
          job: analyticsRollupDailyJobName,
          id: job.id,
          data,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

void main();
