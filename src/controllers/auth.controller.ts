import { Request, Response } from 'express';
import { catchAsync } from '../utils/errors';
import * as authService from '../services/auth.service';
import { AuthRequest } from '../middlewares/auth';

export const register = catchAsync(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  const result = await authService.register({ email, password, name });

  res.status(201).json({
    status: 'success',
    data: result,
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const getMe = catchAsync(async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});
