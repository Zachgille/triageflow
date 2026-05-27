import { BadRequestException } from '@nestjs/common';

import { decodeCreatedAtIdCursor, type CreatedAtIdCursor } from '../pagination/cursor';
import { commentVisibilities, type CommentVisibility } from './comment.types';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxCommentLength = 10000;
const maxListLimit = 100;

type UnknownRecord = Record<string, unknown>;

export type CreateCommentBody = {
  visibility: CommentVisibility;
  body: string;
};

export type CommentListQuery = {
  limit?: number;
  cursor?: CreatedAtIdCursor;
};

export function parseTicketId(value: string) {
  if (!uuidPattern.test(value)) {
    throwValidationError('ticketId must be a UUID.');
  }

  return value;
}

export function parseCreateCommentBody(body: unknown): CreateCommentBody {
  const value = assertRecord(body);

  return {
    visibility: parseVisibility(value.visibility),
    body: parseBody(value.body),
  };
}

export function parseCommentListQuery(query: UnknownRecord): CommentListQuery {
  const cursor = decodeCreatedAtIdCursor(query.cursor);

  return {
    limit: parseLimit(query.limit),
    ...(cursor ? { cursor } : {}),
  };
}

function assertRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwValidationError('Request body must be an object.');
  }

  return value as UnknownRecord;
}

function parseVisibility(value: unknown): CommentVisibility {
  if (typeof value !== 'string' || !commentVisibilities.includes(value as CommentVisibility)) {
    throwValidationError(`visibility must be one of: ${commentVisibilities.join(', ')}.`);
  }

  return value as CommentVisibility;
}

function parseBody(value: unknown) {
  if (typeof value !== 'string') {
    throwValidationError('body must be a string.');
  }

  const trimmed = value.trim();

  if (trimmed.length < 1 || trimmed.length > maxCommentLength) {
    throwValidationError(`body length must be between 1 and ${maxCommentLength} characters.`);
  }

  return trimmed;
}

function parseLimit(value: unknown) {
  if (value === undefined) {
    return 50;
  }

  const parsed = typeof value === 'string' ? Number(value) : value;

  if (!Number.isInteger(parsed) || typeof parsed !== 'number' || parsed < 1 || parsed > maxListLimit) {
    throwValidationError(`limit must be an integer between 1 and ${maxListLimit}.`);
  }

  return parsed;
}

function throwValidationError(message: string): never {
  throw new BadRequestException({
    status: 'error',
    code: 'VALIDATION_ERROR',
    message,
  });
}
