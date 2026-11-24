import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from '@vidcraft/shared/server';
import { errorHandler, notFound } from './http/errors.ts';
import { identifyUser } from './modules/auth/auth.middleware.ts';
import { authRoutes } from './modules/auth/auth.routes.ts';
import type { AuthService } from './modules/auth/auth.service.ts';
import { jobsRoutes } from './modules/jobs/jobs.routes.ts';
import type { JobsService } from './modules/jobs/jobs.service.ts';
import { videosRoutes } from './modules/videos/videos.routes.ts';
import type { VideosService } from './modules/videos/videos.service.ts';

export interface AppDeps {
  logger: Logger;
  webOrigin: string;
  secureCookies: boolean;
  auth: AuthService;
  jobs: JobsService;
  videos: VideosService;
  /** Resolves if the app's dependencies are reachable; used by the health check. */
  checkHealth: () => Promise<void>;
}

/** Builds the HTTP app from its dependencies. No I/O happens here, so tests can pass fakes. */
export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(pinoHttp({ logger: deps.logger }));
  app.use(cors({ origin: deps.webOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' })); // video bytes never go through the API
  app.use(cookieParser());
  app.use(identifyUser(deps.auth));

  app.get('/api/v1/health', async (_req, res) => {
    await deps.checkHealth();
    res.json({ status: 'ok' });
  });
  app.use('/api/v1/auth', authRoutes(deps.auth, deps.secureCookies));
  app.use('/api/v1/jobs', jobsRoutes(deps.jobs));
  app.use('/api/v1/videos', videosRoutes(deps.videos));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
