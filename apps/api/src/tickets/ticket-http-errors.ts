import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import {
  InvalidTicketStatusTransitionError,
  TicketDomainError,
  TicketNotFoundError,
  TicketTenantConstraintError,
} from './ticket.errors';

export function toTicketHttpException(error: unknown) {
  if (error instanceof TicketNotFoundError) {
    return new NotFoundException({
      status: 'error',
      code: error.code,
      message: 'Ticket was not found.',
    });
  }

  if (error instanceof InvalidTicketStatusTransitionError) {
    return new ConflictException({
      status: 'error',
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof TicketTenantConstraintError) {
    return new BadRequestException({
      status: 'error',
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof TicketDomainError) {
    return new BadRequestException({
      status: 'error',
      code: error.code,
      message: error.message,
    });
  }

  return error;
}
