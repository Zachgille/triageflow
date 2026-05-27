import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { DatabaseModule } from '../database/database.module';
import { SlaBreachCheckService } from './sla-breach-check.service';
import { SlaBreachRepository } from './sla-breach.repository';

@Module({
  imports: [DatabaseModule],
  providers: [SlaBreachRepository, SlaBreachCheckService],
})
class SlaCheckCliModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(SlaCheckCliModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const service = app.get(SlaBreachCheckService);
    const result = await service.run(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

function parseArgs(args: string[]) {
  const parsed: { tenantId?: string; limit?: number; now?: Date } = {};

  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, '').split('=', 2);

    if (!value) {
      continue;
    }

    if (key === 'tenantId') {
      parsed.tenantId = value;
    }

    if (key === 'limit') {
      parsed.limit = Number(value);
    }

    if (key === 'now') {
      parsed.now = new Date(value);
    }
  }

  return parsed;
}

void main();
