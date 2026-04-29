import { Response } from 'express';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

export const successResponse = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(response);
};

export const paginatedResponse = <T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  limit: number,
  message: string = 'Success',
  statusCode: number = 200
): void => {
  const totalPages = Math.ceil(total / limit);
  const response: ApiResponse<PaginatedResponse<T>> = {
    success: true,
    message,
    data: {
      items,
      total,
      page,
      limit,
      totalPages,
    },
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(response);
};

export const errorResponse = (
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): void => {
  const response: ApiResponse = {
    success: false,
    message,
    error: {
      code,
      details: details || undefined,
    },
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(response);
};
