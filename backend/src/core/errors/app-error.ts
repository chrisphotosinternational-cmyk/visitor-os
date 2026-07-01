export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;

  constructor(
    message: string,
    options?: { statusCode?: number; code?: string; isOperational?: boolean }
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = options?.statusCode ?? 500;
    this.code = options?.code ?? 'APP_ERROR';
    this.isOperational = options?.isOperational ?? true;
  }
}
