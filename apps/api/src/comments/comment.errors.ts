export class CommentDomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export class CommentTenantConstraintError extends CommentDomainError {
  constructor(message: string) {
    super(message, 'COMMENT_TENANT_CONSTRAINT');
  }
}

export class CommentPermissionError extends CommentDomainError {
  constructor(message: string) {
    super(message, 'COMMENT_PERMISSION_REQUIRED');
  }
}
