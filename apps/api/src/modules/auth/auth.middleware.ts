import type { RequestHandler } from 'express';
import { HttpError } from '../../http/errors.ts';
import type { AuthService } from './auth.service.ts';

declare global {
  namespace Express {
    interface Request {
      /** Set when the request carries a valid session cookie. */
      userId?: string;
    }
  }
}

export const SESSION_COOKIE = 'vc_session';

/** Identifies the user if a valid session cookie is present; never rejects. */
export const identifyUser =
  (auth: AuthService): RequestHandler =>
  (req, _res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') req.userId = auth.verifyToken(token) ?? undefined;
    next();
  };

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.userId) throw new HttpError(401, 'unauthenticated', 'Please sign in');
  next();
};
