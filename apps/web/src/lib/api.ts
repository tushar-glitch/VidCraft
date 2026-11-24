import type {
  AnalyticsOverviewDto,
  ApiErrorBody,
  CreateJobRequest,
  CreateJobResponse,
  CreateVideoRequest,
  CreateVideoResponse,
  JobDto,
  LoginRequest,
  RegisterRequest,
  SlowViewDto,
  UpdateVideoRequest,
  UserDto,
  VideoDto,
  ViewTraceDto,
} from '@vidcraft/shared';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Field name → messages, for validation errors. */
    readonly fieldErrors: Record<string, string[] | undefined> = {},
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach the server. Check your connection.');
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    const details = err?.code === 'validation_error' ? (err.details as Record<string, string[]>) : {};
    throw new ApiError(res.status, err?.code ?? 'unknown', err?.message ?? `Request failed (${res.status})`, details);
  }
  return data as T;
}

export const api = {
  me: () => request<{ user: UserDto | null }>('GET', '/auth/me').then((r) => r.user),
  login: (body: LoginRequest) => request<{ user: UserDto }>('POST', '/auth/login', body).then((r) => r.user),
  register: (body: RegisterRequest) => request<{ user: UserDto }>('POST', '/auth/register', body).then((r) => r.user),
  logout: () => request<void>('POST', '/auth/logout'),

  createJob: (body: CreateJobRequest) => request<CreateJobResponse>('POST', '/jobs', body),
  startJob: (id: string) => request<{ job: JobDto }>('POST', `/jobs/${id}/start`).then((r) => r.job),
  getJob: (id: string) => request<{ job: JobDto }>('GET', `/jobs/${id}`).then((r) => r.job),
  listJobs: () => request<{ jobs: JobDto[] }>('GET', '/jobs').then((r) => r.jobs),

  analyticsOverview: (days: number) => request<AnalyticsOverviewDto>('GET', `/analytics/overview?days=${days}`),
  slowestViews: (days: number, limit = 10) =>
    request<{ views: SlowViewDto[] }>('GET', `/analytics/slowest?days=${days}&limit=${limit}`).then((r) => r.views),
  viewTrace: (viewId: string) =>
    request<{ view: ViewTraceDto }>('GET', `/analytics/views/${encodeURIComponent(viewId)}`).then((r) => r.view),

  createVideo: (body: CreateVideoRequest) => request<CreateVideoResponse>('POST', '/videos', body),
  startVideo: (id: string) => request<{ video: VideoDto }>('POST', `/videos/${id}/start`).then((r) => r.video),
  getVideo: (id: string) => request<{ video: VideoDto }>('GET', `/videos/${id}`).then((r) => r.video),
  listVideos: () => request<{ videos: VideoDto[] }>('GET', '/videos').then((r) => r.videos),
  updateVideo: (id: string, body: UpdateVideoRequest) =>
    request<{ video: VideoDto }>('PATCH', `/videos/${id}`, body).then((r) => r.video),
  deleteVideo: (id: string) => request<void>('DELETE', `/videos/${id}`),
};

/**
 * PUTs a file straight to storage with a signed URL.
 * Uses XMLHttpRequest because fetch() can't report upload progress.
 */
export function uploadFile(url: string, file: File, onProgress: (pct: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, 'upload_failed', 'Upload failed. Please try again.'));
    xhr.onerror = () => reject(new ApiError(0, 'upload_failed', 'Upload failed. Check your connection.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
