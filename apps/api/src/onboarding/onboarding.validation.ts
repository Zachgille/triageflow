import { BadRequestException } from '@nestjs/common';

export type CreateTenantBody = {
  name: string;
  slug: string;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseCreateTenantBody(body: unknown): CreateTenantBody {
  const value = assertRecord(body);
  const name = parseText(value.name, 'name', 1, 120);
  const slug = parseText(value.slug, 'slug', 3, 64).toLowerCase();

  if (!slugPattern.test(slug)) {
    throwValidationError('slug must contain lowercase letters, numbers, and single hyphens only.');
  }

  return { name, slug };
}

function assertRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwValidationError('Request body must be an object.');
  }

  return value as Record<string, unknown>;
}

function parseText(value: unknown, field: string, minLength: number, maxLength: number) {
  if (typeof value !== 'string') {
    throwValidationError(`${field} must be a string.`);
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throwValidationError(`${field} length must be between ${minLength} and ${maxLength} characters.`);
  }

  return trimmed;
}

function throwValidationError(message: string): never {
  throw new BadRequestException({
    status: 'error',
    code: 'VALIDATION_ERROR',
    message,
  });
}
