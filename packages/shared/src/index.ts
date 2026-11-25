// Contracts shared by the API, the worker and the web app.
// Keep this file free of Node-only imports: the browser bundles it.
import { z } from 'zod';

const MB = 1024 * 1024;

/** Max upload size in bytes, by who is uploading. */
export const UPLOAD_LIMITS = { anonymous: 50 * MB, user: 200 * MB } as const;

export const VIDEO_FORMATS = ['mp4', 'mov', 'mkv'] as const;
export const VIDEO_CODECS = ['h264', 'h265'] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export const compressParamsSchema = z.object({
  /** Output size as a percentage of the input's video bitrate. */
  targetPercent: z.number().int().min(10).max(90),
  format: z.enum(VIDEO_FORMATS),
  codec: z.enum(VIDEO_CODECS),
});

const dimension = z.number().int().min(16).max(3840);
export const resizeParamsSchema = z.object({
  width: dimension,
  height: dimension,
  format: z.enum(VIDEO_FORMATS),
});

/** What to do with the video. Adding an operation starts here. */
export const jobTaskSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('compress'), params: compressParamsSchema }),
  z.object({ operation: z.literal('resize'), params: resizeParamsSchema }),
]);
export type JobTask = z.infer<typeof jobTaskSchema>;
export type OperationName = JobTask['operation'];
export type ParamsOf<O extends OperationName> = Extract<JobTask, { operation: O }>['params'];

export const createJobRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
  task: jobTaskSchema,
});
export type CreateJobRequest = z.infer<typeof createJobRequestSchema>;

export const JOB_STATUSES = ['awaiting_upload', 'queued', 'processing', 'completed', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface JobDto {
  id: string;
  task: JobTask;
  status: JobStatus;
  /** 0-100 */
  progress: number;
  inputName: string;
  inputSize: number;
  outputSize: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  /** Short-lived link, present only when status is "completed". */
  downloadUrl: string | null;
}

export interface CreateJobResponse {
  job: JobDto;
  /** PUT the file body here, then call POST /jobs/:id/start. */
  uploadUrl: string;
}

export const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  email: z.email().max(254).transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(72), // bcrypt ignores bytes past 72
});
export type RegisterRequest = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(72),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

// ---- Video library (streamable videos for feeds) ----

export const VIDEO_STATUSES = ['awaiting_upload', 'queued', 'processing', 'ready', 'failed'] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const PUBLISH_STATUSES = ['unpublished', 'published'] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

const videoTitle = z.string().trim().min(1).max(200);

export const createVideoRequestSchema = z.object({
  title: videoTitle,
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
});
export type CreateVideoRequest = z.infer<typeof createVideoRequestSchema>;

export const updateVideoSchema = z
  .object({ title: videoTitle, publishStatus: z.enum(PUBLISH_STATUSES) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateVideoRequest = z.infer<typeof updateVideoSchema>;

/** One quality level of a streamable video. */
export interface RenditionDto {
  /** The shorter side of the picture, e.g. "720p". */
  name: string;
  width: number;
  height: number;
  /** Target video bitrate in kbit/s. */
  videoKbps: number;
}

export interface VideoDto {
  id: string;
  title: string;
  status: VideoStatus;
  /** 0-100 while processing */
  progress: number;
  publishStatus: PublishStatus;
  sourceName: string;
  sourceSize: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  /** Reduced ratio of the picture as shown, e.g. "9:16". */
  aspectRatio: string | null;
  renditions: RenditionDto[];
  /** HLS master playlist; present once status is "ready". */
  streamingUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  createdAt: string;
}

/** A video as the feed SDK needs it. Public: never contains owner details. */
export interface FeedItemDto {
  id: string;
  title: string;
  /** HLS master playlist. */
  streamingUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  width: number;
  height: number;
  aspectRatio: string;
}

export interface FeedPageDto {
  items: FeedItemDto[];
  /** Pass back as `cursor` to get the next page; null when there are no more. */
  nextCursor: string | null;
}

export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(10),
  cursor: z.string().max(200).optional(),
});

// ---- Playback analytics: what the SDK reports and the API accepts ----

const ms = (max: number) => z.number().int().min(0).max(max);
const eventBase = {
  itemId: z.uuid(),
  /** One play of one video: from it becoming current to the viewer leaving it. */
  viewId: z.string().min(8).max(64),
  /** When it happened on the viewer's device, in ms since the epoch. */
  t: z.number().int().positive(),
};

/** Where the time to first frame went. The four parts add up to `startupMs`. */
export const startupBreakdownSchema = z.object({
  /** Fetching the master playlist (the list of qualities). */
  manifestMs: ms(120_000),
  /** Fetching the playlist for the chosen quality. */
  levelMs: ms(120_000),
  /** Downloading the first piece of video. */
  fragmentMs: ms(120_000),
  /** Decoding it and getting the first picture on screen. */
  renderMs: ms(120_000),
});
export type StartupBreakdown = z.infer<typeof startupBreakdownSchema>;

export const playbackEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('impression'), ...eventBase, index: ms(1_000_000) }),
  z.object({
    type: z.literal('firstFrame'),
    ...eventBase,
    index: ms(1_000_000),
    startupMs: ms(120_000),
    preloaded: z.boolean(),
    /** Shorter side in pixels of the quality that started, e.g. 720 for 720p. */
    quality: ms(8000).nullable(),
    /** The player's bandwidth estimate when it started, in kbit/s. */
    bandwidthKbps: ms(1_000_000).nullable(),
    breakdown: startupBreakdownSchema,
    /** Size of the first piece of video, in bytes. */
    fragmentBytes: ms(1_000_000_000).nullable(),
  }),
  z.object({ type: z.literal('rebuffer'), ...eventBase, durationMs: ms(600_000) }),
  z.object({ type: z.literal('qualityChange'), ...eventBase, from: ms(8000).nullable(), to: ms(8000) }),
  z.object({ type: z.literal('viewEnd'), ...eventBase, index: ms(1_000_000), watchTimeMs: ms(86_400_000), completed: z.boolean() }),
  z.object({ type: z.literal('error'), ...eventBase, message: z.string().max(200) }),
]);
export type PlaybackEvent = z.infer<typeof playbackEventSchema>;

export const playbackContextSchema = z.object({
  /** Random per browser tab session. Not tied to a person. */
  sessionId: z.string().min(8).max(64),
  /** Browser-reported connection class ("4g", "3g"…), when it offers one. */
  network: z.string().max(16).nullable(),
  device: z.enum(['touch', 'desktop']),
  sdk: z.string().max(20),
});
export type PlaybackContext = z.infer<typeof playbackContextSchema>;

/** Events are validated one by one on the server, so one bad event doesn't discard the batch. */
export const playbackBatchSchema = z.object({
  context: playbackContextSchema,
  events: z.array(z.unknown()).max(100),
});

// ---- Webhooks: VidCraft calls your server when something happens ----

export const WEBHOOK_EVENTS = ['video.ready', 'video.failed', 'ping'] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];
export const MAX_WEBHOOKS_PER_USER = 5;

export const createWebhookSchema = z.object({ url: z.string().trim().max(500) });

export interface WebhookEndpointDto {
  id: string;
  url: string;
  createdAt: string;
  /** The signing secret. Only returned when the endpoint is created: store it then. */
  secret?: string;
}

export interface WebhookDeliveryDto {
  id: string;
  eventType: WebhookEventType;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  /** HTTP status your server answered with, on the latest attempt. */
  lastStatus: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

/** The JSON body of every webhook request. */
export interface WebhookPayload {
  /** Delivery id: the same for every retry, so receivers can ignore duplicates. */
  id: string;
  type: WebhookEventType;
  createdAt: string;
  data: Record<string, unknown>;
}

// ---- Benchmark results (written by apps/bench, shown on the Benchmarks page) ----

export interface BenchSummary {
  /** How many measurements the numbers come from. */
  n: number;
  medianMs: number;
  p95Ms: number;
}

export interface BenchRow {
  network: string;
  impl: 'sdk' | 'naive';
  /** First video of a visit: from mounting the feed to the first advancing frame. */
  cold: BenchSummary;
  /** Each later video: from the swipe to the first advancing frame. */
  swipe: BenchSummary;
  /** Share of swipes that stalled at least once during the first seconds of watching. */
  stalledShare: number;
  /** Median total stall time among the swipes that stalled; null if none did. */
  stallMsMedian: number | null;
  /** Swipes that never played within the time limit. They count as the limit in the numbers above. */
  timeouts: number;
  /** Video data downloaded per video watched, in megabytes, including anything preloaded. */
  megabytesPerView: number;
  /** Median shorter side, in pixels, of the quality that started playing (720 means 720p). */
  qualityMedian: number | null;
}

export interface BenchmarkResultDto {
  generatedAt: string;
  chrome: string;
  platform: string;
  /** Sessions per network and implementation. */
  reps: number;
  swipesPerSession: number;
  /** How long each video was watched before the next swipe. */
  watchMs: number;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  networks: { id: string; label: string; downKbps: number | null; latencyMs: number }[];
  rows: BenchRow[];
}

// ---- Analytics dashboard (owner-only) ----

export const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ConnectionBucket = 'slow' | 'medium' | 'fast' | 'unknown';

/** Groups a measured speed (kbit/s). The API's SQL uses the same thresholds. */
export function connectionBucket(kbps: number | null): ConnectionBucket {
  if (kbps === null) return 'unknown';
  return kbps < 1000 ? 'slow' : kbps < 5000 ? 'medium' : 'fast';
}

export interface AnalyticsOverviewDto {
  days: number;
  /** Times a video became the current one. */
  views: number;
  /** Of those, how many reached a first frame. */
  started: number;
  watchTimeMs: number;
  /** Share of finished views that reached 95% of the video; null if none finished yet. */
  completionRate: number | null;
  startupP50Ms: number | null;
  /** The slow tail: 1 view in 20 started slower than this. */
  startupP95Ms: number | null;
  /** Share of starts where the video was already loaded in the background. */
  preloadedShare: number | null;
  /** Share of started views that stalled at least once. */
  rebufferRate: number | null;
  /** Start-up and stalls split by the viewer's measured connection speed. */
  byConnection: { bucket: ConnectionBucket; views: number; startupP50Ms: number | null; startupP95Ms: number | null; rebufferRate: number | null }[];
  daily: { day: string; views: number; startupP50Ms: number | null; startupP95Ms: number | null }[];
}

export interface StartupDto {
  startupMs: number;
  preloaded: boolean;
  quality: number | null;
  bandwidthKbps: number | null;
  breakdown: StartupBreakdown;
  fragmentBytes: number | null;
}

export interface SlowViewDto extends StartupDto {
  viewId: string;
  itemId: string;
  title: string;
  at: string;
  network: string | null;
  device: 'touch' | 'desktop';
}

export interface ViewTraceDto {
  viewId: string;
  itemId: string;
  title: string;
  startedAt: string;
  network: string | null;
  device: 'touch' | 'desktop';
  startup: StartupDto | null;
  rebuffers: number[];
  qualityChanges: { from: number | null; to: number }[];
  errors: string[];
  watchTimeMs: number | null;
  completed: boolean | null;
}

export interface CreateVideoResponse {
  video: VideoDto;
  /** PUT the file here, then call POST /videos/:id/start. */
  uploadUrl: string;
}
