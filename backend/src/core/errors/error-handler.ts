import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) => {
      const appError = normalizeError(error);

      request.log.error(
        {
          error: {
            code: appError.code,
            message: appError.message,
            stack: appError.stack,
            isOperational: appError.isOperational
          }
        },
        'Request failed'
      );

      const response: ErrorResponse = {
        error: {
          code: appError.code,
          message: appError.isOperational ? appError.message : 'Internal server error'
        }
      };

      void reply.status(appError.statusCode).send(response);
    }
  );
}

function normalizeError(error: FastifyError | AppError): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError('Invalid request payload', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }

  const statusCode = error.statusCode ?? 500;

  return new AppError(statusCode >= 500 ? 'Internal server error' : error.message, {
    statusCode,
    code: error.code ?? 'UNEXPECTED_ERROR',
    isOperational: statusCode < 500
  });
}
