import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { ConflictError, UnauthorizedError } from '../utils/errors';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-development-only-123456!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (payload: { id: string; email: string; role: UserRole }): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
};

export const register = async (data: { email: string; password: string; name?: string }) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new ConflictError('Email is already in use');
  }

  const hashedPassword = await bcrypt.hash(data.password, 12);

  const newUser = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: UserRole.USER, // Default to USER, first user manually changed to admin if needed
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  const token = generateToken({
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
  });

  return { user: newUser, token };
};

export const login = async (data: { email: string; password: string }) => {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user || !(await bcrypt.compare(data.password, user.password))) {
    throw new UnauthorizedError('Incorrect email or password');
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
  };
};
