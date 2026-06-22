import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError, catchAsync } from '../utils/errors';
import prisma from '../config/db';
import { UserRole } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    name: string | null;
  };
}

interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
}

export const protect = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // 1) Getting token and check if it's there
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new UnauthorizedError('You are not logged in. Please log in to get access.'));
  }

  // 2) Verification of token
  const secret = process.env.JWT_SECRET || 'super-secret-jwt-key-for-development-only-123456!';
  
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, secret) as JwtPayload;
  } catch (err) {
    return next(new UnauthorizedError('Invalid token or token has expired.'));
  }

  // 3) Check if user still exists
  const currentUser = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
    },
  });

  if (!currentUser) {
    return next(new UnauthorizedError('The user belonging to this token no longer exists.'));
  }

  // 4) Grant access to protected route
  req.user = currentUser;
  next();
});

export const restrictTo = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action.'));
    }
    next();
  };
};
