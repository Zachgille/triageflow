import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { CommentDomainError, CommentPermissionError, CommentTenantConstraintError } from './comment.errors';

export function toCommentHttpException(error: unknown) {
  if (error instanceof CommentTenantConstraintError) {
    return new NotFoundException({
      status: 'error',
      code: error.code,
      message: 'Ticket was not found.',
    });
  }

  if (error instanceof CommentPermissionError) {
    return new ForbiddenException({
      status: 'error',
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof CommentDomainError) {
    return new ForbiddenException({
      status: 'error',
      code: error.code,
      message: error.message,
    });
  }

  return error;
}
