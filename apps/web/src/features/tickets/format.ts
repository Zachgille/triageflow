import type { TicketPriority, TicketStatus } from '../../lib/api-client';

export const ticketStatuses: TicketStatus[] = [
  'NEW',
  'OPEN',
  'PENDING_CUSTOMER',
  'PENDING_INTERNAL',
  'RESOLVED',
  'CLOSED',
];

export const ticketPriorities: TicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatDate(value: string | null) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function shortId(value: string | null) {
  if (!value) {
    return 'Unassigned';
  }

  return value.slice(0, 8);
}
