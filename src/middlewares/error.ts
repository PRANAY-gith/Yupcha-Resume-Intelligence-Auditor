import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If it's a validation error from Zod
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    
    return res.status(400).json({
      status: 'fail',
      message: 'Validation Error',
      errors,
    });
  }

  // If it is our custom operational AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.statusCode >= 500 ? 'error' : 'fail',
      message: err.message,
    });
  }

  // Handle Prisma Database Errors
  if (err.name === 'PrismaClientKnownRequestError') {
    // We can cast to any to read the prisma code
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      return res.status(409).json({
        status: 'fail',
        message: `Duplicate field value: ${prismaErr.meta?.target || 'field'}. Please use another value.`,
      });
    }
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({
        status: 'fail',
        message: prismaErr.meta?.cause || 'Record not found.',
      });
    }
  }

  // Fallback for unhandled developer or system errors
  console.error('Unhandled Error 💥:', err);
  
  return res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error occurred' 
      : err.message,
  });
};
