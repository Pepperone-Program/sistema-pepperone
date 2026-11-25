import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '@utils/response';
import multer from 'multer';

export const errorHandler = (
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', error);

  const statusCode = error instanceof multer.MulterError ? 400 : error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT'
    ? 'Quantidade de arquivos acima do limite permitido'
    : error.message || 'Internal server error';

  errorResponse(res, code, message, statusCode);
};

export const notFoundHandler = (
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  errorResponse(res, 'NOT_FOUND', 'Route not found', 404);
};
