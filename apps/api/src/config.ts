import { z } from 'zod';
import { baseEnvSchema, loadEnv } from '@vidcraft/shared/server';

const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
});
export type ApiConfig = z.infer<typeof apiEnvSchema>;

export const loadApiConfig = () => loadEnv(apiEnvSchema);
