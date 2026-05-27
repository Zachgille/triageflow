import { BadRequestException } from '@nestjs/common';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CreatedAtIdCursor = {
  createdAt: Date;
  id: string;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

type EncodedCursor = {
  createdAt: string;
  id: string;
};

export function encodeCreatedAtIdCursor(record: { createdAt: Date; id: string }) {
  const payload: EncodedCursor = {
    createdAt: record.createdAt.toISOString(),
    id: record.id,
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCreatedAtIdCursor(value: unknown): CreatedAtIdCursor | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throwInvalidCursor();
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<EncodedCursor>;

    if (typeof decoded.id !== 'string' || !uuidPattern.test(decoded.id)) {
      throwInvalidCursor();
    }

    if (typeof decoded.createdAt !== 'string') {
      throwInvalidCursor();
    }

    const createdAt = new Date(decoded.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      throwInvalidCursor();
    }

    return {
      createdAt,
      id: decoded.id,
    };
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throwInvalidCursor();
  }
}

export function toCursorPage<T extends { createdAt: Date; id: string }>(
  records: T[],
  limit: number,
): CursorPage<T> {
  const hasMore = records.length > limit;
  const items = hasMore ? records.slice(0, limit) : records;
  const lastItem = items[items.length - 1];

  return {
    items,
    nextCursor: hasMore && lastItem ? encodeCreatedAtIdCursor(lastItem) : null,
    hasMore,
  };
}

function throwInvalidCursor(): never {
  throw new BadRequestException({
    status: 'error',
    code: 'VALIDATION_ERROR',
    message: 'cursor must be a valid opaque pagination cursor.',
  });
}
