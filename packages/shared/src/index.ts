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
