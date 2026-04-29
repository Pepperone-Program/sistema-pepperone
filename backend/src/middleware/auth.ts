import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@utils/helpers';
import { errorResponse } from '@utils/response';

export interface AuthenticatedRequest extends Request {
  user?: {
    id_usuario: number;
    id_empresa: number;
    usuario: string;
    email: string;
  };
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      errorResponse(res, 'NO_TOKEN', 'Token not provided', 401);
      return;
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    errorResponse(res, 'INVALID_TOKEN', 'Invalid or expired token', 401);
  }
};

export const optionalAuthMiddleware = (
  req: AuthenticatedRequest,
    _res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
    }
    next();
  } catch (error) {
    next();
  }
};
