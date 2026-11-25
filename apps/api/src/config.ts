import { z } from 'zod';
import { baseEnvSchema, loadEnv } from '@vidcraft/shared/server';

const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /**
   * Set to true when the API sits behind exactly one reverse proxy (nginx, a load balancer). Without it every
   * request appears to come from the proxy, so the per-IP rate limit would treat all visitors as one.
   * Leave false when the API is reachable directly: otherwise anyone could fake their address.
   */
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});
export type ApiConfig = z.infer<typeof apiEnvSchema>;

export const loadApiConfig = () => loadEnv(apiEnvSchema);
