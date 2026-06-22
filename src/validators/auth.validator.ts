import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string({
      required_error: 'Email is required',
    }).email('Invalid email address'),
    password: z.string({
      required_error: 'Password is required',
    }).min(6, 'Password must be at least 6 characters long'),
    name: z.string().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string({
      required_error: 'Email is required',
    }).email('Invalid email address'),
    password: z.string({
      required_error: 'Password is required',
    }),
  }),
});
