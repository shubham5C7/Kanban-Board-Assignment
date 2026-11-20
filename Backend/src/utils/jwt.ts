import jwt, { SignOptions } from 'jsonwebtoken';
import { ENV } from '../config/env';
import { AuthUser } from '../types';

export function signToken(user: AuthUser): string {
  const options: SignOptions = {
    expiresIn: (ENV.JWT_EXPIRES_IN as any) || '7d',
  };

  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    ENV.JWT_SECRET,
    options
  );
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, ENV.JWT_SECRET) as AuthUser;
}
