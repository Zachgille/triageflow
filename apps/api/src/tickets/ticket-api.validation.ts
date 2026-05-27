import { BadRequestException } from '@nestjs/common';

import { decodeCreatedAtIdCursor, type CreatedAtIdCursor } from '../pagination/cursor';
import { ticketPriorities, ticketStatuses, type TicketPriority, type TicketStatus } from './ticket.types';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxListLimit = 100;

type UnknownRecord = Record<string, unknown>;

export type TicketListQuery = {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeUserId?: string | null;
  limit?: number;
  cursor?: CreatedAtIdCursor;
};

export type CreateTicketBody = {
  requesterId: string;
  assigneeUserId?: string | null;
  priority?: TicketPriority;
  subject: string;
  description: string;
};

export type UpdateTicketBody = {
  requesterId?: string;
  assigneeUserId?: string | null;
  priority?: TicketPriority;
  subject?: string;
  description?: string;
};

export type TransitionTicketBody = {
  status: TicketStatus;
};

export type AssignTicketBody = {
  assigneeUserId: string | null;
};

export function parseTicketId(value: string) {
  if (!isUuid(value)) {
    throwValidationError('ticketId must be a UUID.');
  }

  return value;
}

export function parseListQuery(query: UnknownRecord): TicketListQuery {
  const cursor = decodeCreatedAtIdCursor(query.cursor);

  return {
    ...(query.status !== undefined ? { status: parseEnum(query.status, ticketStatuses, 'status') } : {}),
    ...(query.priority !== undefined ? { priority: parseEnum(query.priority, ticketPriorities, 'priority') } : {}),
    ...(query.assigneeUserId !== undefined
      ? { assigneeUserId: parseNullableUuid(query.assigneeUserId, 'assigneeUserId') }
      : {}),
    limit: parseLimit(query.limit),
    ...(cursor ? { cursor } : {}),
  };
}

export function parseCreateTicketBody(body: unknown): CreateTicketBody {
  const value = assertRecord(body);

  return {
    requesterId: parseUuid(value.requesterId, 'requesterId'),
    ...(value.assigneeUserId !== undefined
      ? { assigneeUserId: parseNullableUuid(value.assigneeUserId, 'assigneeUserId') }
      : {}),
    ...(value.priority !== undefined ? { priority: parseEnum(value.priority, ticketPriorities, 'priority') } : {}),
    subject: parseText(value.subject, 'subject', 1, 200),
    description: parseText(value.description, 'description', 1, 10000),
  };
}

export function parseUpdateTicketBody(body: unknown): UpdateTicketBody {
  const value = assertRecord(body);
  const parsed: UpdateTicketBody = {
    ...(value.requesterId !== undefined ? { requesterId: parseUuid(value.requesterId, 'requesterId') } : {}),
    ...(value.assigneeUserId !== undefined
      ? { assigneeUserId: parseNullableUuid(value.assigneeUserId, 'assigneeUserId') }
      : {}),
    ...(value.priority !== undefined ? { priority: parseEnum(value.priority, ticketPriorities, 'priority') } : {}),
    ...(value.subject !== undefined ? { subject: parseText(value.subject, 'subject', 1, 200) } : {}),
    ...(value.description !== undefined
      ? { description: parseText(value.description, 'description', 1, 10000) }
      : {}),
  };

  if (Object.keys(parsed).length === 0) {
    throwValidationError('At least one update field is required.');
  }

  return parsed;
}

export function parseTransitionTicketBody(body: unknown): TransitionTicketBody {
  const value = assertRecord(body);
  return {
    status: parseEnum(value.status, ticketStatuses, 'status'),
  };
}

export function parseAssignTicketBody(body: unknown): AssignTicketBody {
  const value = assertRecord(body);
  return {
    assigneeUserId: parseNullableUuid(value.assigneeUserId, 'assigneeUserId'),
  };
}

function assertRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwValidationError('Request body must be an object.');
  }

  return value as UnknownRecord;
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

function parseUuid(value: unknown, field: string) {
  if (typeof value !== 'string' || !isUuid(value)) {
    throwValidationError(`${field} must be a UUID.`);
  }

  return value;
}

function parseNullableUuid(value: unknown, field: string) {
  if (value === null || value === '') {
    return null;
  }

  return parseUuid(value, field);
}

function parseEnum<T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throwValidationError(`${field} must be one of: ${allowed.join(', ')}.`);
  }

  return value;
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

function isUuid(value: string) {
  return uuidPattern.test(value);
}

function throwValidationError(message: string): never {
  throw new BadRequestException({
    status: 'error',
    code: 'VALIDATION_ERROR',
    message,
  });
}
