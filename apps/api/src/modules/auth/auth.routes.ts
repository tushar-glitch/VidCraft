import { Router, type CookieOptions, type Response } from 'express';
import { loginSchema, registerSchema } from '@vidcraft/shared';
import { HttpError, parse } from '../../http/errors.ts';
import { requireUser, SESSION_COOKIE } from './auth.middleware.ts';
import { SESSION_TTL_SECONDS, toUserDto, type AuthService } from './auth.service.ts';

export function authRoutes(auth: AuthService, secureCookies: boolean): Router {
  const cookieOptions: CookieOptions = {
    httpOnly: true, // not readable from JavaScript
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
  };
  const setSession = (res: Response, token: string) =>
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS * 1000 });

  const router = Router();

  router.post('/register', async (req, res) => {
    const { user, token } = await auth.register(parse(registerSchema, req.body));
    setSession(res, token);
    res.status(201).json({ user: toUserDto(user) });
  });

  router.post('/login', async (req, res) => {
    const { user, token } = await auth.login(parse(loginSchema, req.body));
    setSession(res, token);
    res.json({ user: toUserDto(user) });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.get('/me', requireUser, async (req, res) => {
    const user = await auth.getUser(req.userId!);
    if (!user) throw new HttpError(401, 'unauthenticated', 'Please sign in');
    res.json({ user: toUserDto(user) });
  });

  return router;
}
