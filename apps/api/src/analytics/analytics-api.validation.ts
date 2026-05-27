import { BadRequestException } from '@nestjs/common';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const maxDailyRollupRangeDays = 90;

export type DailyRollupsQuery = {
  from: Date;
  to: Date;
};

export function parseDailyRollupsQuery(query: Record<string, unknown>): DailyRollupsQuery {
  const from = parseUtcDate(query.from, 'from');
  const to = parseUtcDate(query.to, 'to');

  if (from.getTime() > to.getTime()) {
    throwValidationError('from must be before or equal to to.');
  }

  const inclusiveDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;

  if (inclusiveDays > maxDailyRollupRangeDays) {
    throwValidationError(`Date range must be ${maxDailyRollupRangeDays} days or less.`);
  }

  return { from, to };
}

function parseUtcDate(value: unknown, field: string) {
  if (typeof value !== 'string' || !datePattern.test(value)) {
    throwValidationError(`${field} must use YYYY-MM-DD format.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throwValidationError(`${field} must be a valid UTC calendar date.`);
  }

  return date;
}

function throwValidationError(message: string): never {
  throw new BadRequestException({
    status: 'error',
    code: 'VALIDATION_ERROR',
    message,
  });
}
