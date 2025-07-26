export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    code?: string
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    
    Error.captureStackTrace(this);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, true, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, true, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401, true, 'UNAUTHORIZED');
  }
}

export class AnthropicError extends AppError {
  constructor(message: string, statusCode = 500) {
    super(message, statusCode, true, 'ANTHROPIC_ERROR');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 500, true, 'DATABASE_ERROR');
  }
}