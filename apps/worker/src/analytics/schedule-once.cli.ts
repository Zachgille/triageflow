import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppConfigModule } from '../runtime-config/app-config.module';
import { AnalyticsQueueModule } from './analytics-queue.module';
import { analyticsQueueName, analyticsScheduleDailyRollupsJobName } from './analytics-queue.constants';
import { AnalyticsQueueService } from './analytics-queue.service';
import { parseAnalyticsScheduleArgs } from './schedule-once.args';

@Module({
  imports: [AppConfigModule, AnalyticsQueueModule],
})
class AnalyticsScheduleOnceCliModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(AnalyticsScheduleOnceCliModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const data = parseAnalyticsScheduleArgs(process.argv.slice(2));
    const queue = app.get(AnalyticsQueueService);
    const job = await queue.enqueueScheduleDailyRollups(data);
    console.log(
      JSON.stringify(
        {
          queue: analyticsQueueName,
          job: analyticsScheduleDailyRollupsJobName,
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
