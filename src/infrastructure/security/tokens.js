import jwt from 'jsonwebtoken';

import { AppError } from '../../domain/errors.js';

export function createTokens(secret) {
  return {
    sign(deviceId) {
      return jwt.sign({ sub: deviceId, type: 'device' }, secret, { expiresIn: '30d' });
    },
    read(header) {
      const value = String(header ?? '');
      const token = value.startsWith('Bearer ') ? value.slice(7) : '';
      if (!token) throw new AppError('Sign in is required.', 401);
      try {
        const payload = jwt.verify(token, secret);
        if (!payload.sub) throw new AppError('Sign in is required.', 401);
        return payload.sub;
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('Sign in is required.', 401);
      }
    },
  };
}
