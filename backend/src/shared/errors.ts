export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Thrown by every stub adapter. Never a silent no-op — callers must see
 * that the integration is not implemented yet rather than assume success.
 */
export class NotImplementedError extends AppError {
  constructor(message: string) {
    super(message, 501, 'NOT_IMPLEMENTED');
  }
}

/**
 * Thrown by a live adapter method BEFORE any network call, when a required
 * 1688 credential (e.g. the main-account access token) is not configured.
 * Distinct from NotImplementedError (method not built at all) and from a
 * real 1688 API error (method built, the call itself failed) — this is
 * specifically "method built, but this deployment/environment is missing
 * the credential it needs."
 */
export class Alibaba1688MissingCredentialError extends AppError {
  constructor(message: string) {
    super(message, 500, 'ALIBABA_1688_MISSING_CREDENTIAL');
  }
}
