import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '@utils/response';
import Joi from 'joi';

export const validationMiddleware = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(
      req.body || {},
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      errorResponse(
        res,
        'VALIDATION_ERROR',
        'Validation failed',
        422,
        details
      );
      return;
    }

    req.body = value;
    next();
  };
};

export const queryValidationMiddleware = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(
      req.query || {},
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      errorResponse(
        res,
        'VALIDATION_ERROR',
        'Validation failed',
        422,
        details
      );
      return;
    }

    req.query = value as any;
    next();
  };
};
