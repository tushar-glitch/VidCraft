import { useCallback, useEffect, useRef, useState } from 'react';
import { FiFilm, FiUpload } from 'react-icons/fi';
import { Link } from 'react-router';
import { UPLOAD_LIMITS, type VideoDto, type VideoStatus } from '@vidcraft/shared';
import { api, ApiError, uploadFile } from '../../lib/api.ts';
import { formatBytes } from '../../lib/format.ts';
import { Panel } from './DashboardLayout.tsx';

export const STATUS_STYLE: Record<VideoStatus, { label: string; className: string }> = {
  awaiting_upload: { label: 'Uploading', className: 'bg-gray-100 text-gray-600' },
  queued: { label: 'Queued', className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
  ready: { label: 'Ready', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
};

export const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

const isActive = (v: VideoDto) => v.status === 'awaiting_upload' || v.status === 'queued' || v.status === 'processing';

export function Videos() {
  const [videos, setVideos] = useState<VideoDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; pct: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const refresh = useCallback(() => api.listVideos().then(setVideos, () => setError('Could not load your videos. Please refresh.')), []);
  useEffect(() => {
    refresh();
    return () => abort.current?.abort();
  }, [refresh]);

  // Keep the list live while anything is still being converted.
  const anyActive = videos?.some(isActive) ?? false;
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [anyActive, refresh]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > UPLOAD_LIMITS.user) return setError(`This file is ${formatBytes(file.size)}; the limit is ${formatBytes(UPLOAD_LIMITS.user)}.`);
    abort.current = new AbortController();
    setUpload({ name: file.name, pct: 0 });
    try {
      const title = file.name.replace(/\.[^.]+$/, '').slice(0, 200) || 'Untitled';
      const { video, uploadUrl } = await api.createVideo({ title, fileName: file.name, fileSize: file.size });
      await uploadFile(uploadUrl, file, (pct) => setUpload({ name: file.name, pct }), abort.current.signal);
      await api.startVideo(video.id);
    } catch (err) {
      if (!(err instanceof DOMException)) setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUpload(null);
      refresh();
    }
  }

  return (
    <Panel title="Videos">
      <label
        className={`mb-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-8 text-gray-600 hover:border-brand hover:text-brand ${upload ? 'pointer-events-none opacity-60' : ''}`}
      >
        <FiUpload className="h-6 w-6" />
        <span className="font-medium">{upload ? `Uploading ${upload.name} — ${upload.pct}%` : 'Upload a video'}</span>
        <span className="text-xs text-gray-500">Vertical videos work best · up to {formatBytes(UPLOAD_LIMITS.user)}</span>
        <input type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!videos && !error && <p className="text-gray-500">Loading…</p>}
      {videos?.length === 0 && <p className="text-gray-500">No videos yet. Upload one and it will be converted for streaming.</p>}

      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {videos?.map((v) => (
          <li key={v.id}>
            <Link to={`/dashboard/videos/${v.id}`} className="block overflow-hidden rounded-lg border border-gray-200 hover:shadow-md">
              <div className="relative flex aspect-[9/16] items-center justify-center bg-gray-100">
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <FiFilm className="h-8 w-8 text-gray-400" />
                )}
                {v.durationSec !== null && (
                  <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">{formatDuration(v.durationSec)}</span>
                )}
              </div>
              <div className="p-3">
                <p className="truncate font-medium text-gray-800">{v.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[v.status].className}`} title={v.error ?? undefined}>
                    {STATUS_STYLE[v.status].label}
                    {v.status === 'processing' && ` ${v.progress}%`}
                  </span>
                  {v.status === 'ready' && v.publishStatus === 'unpublished' && <span className="text-xs text-gray-500">Unpublished</span>}
                </div>
                {v.status === 'processing' && (
                  <div className="mt-2 h-1.5 rounded-full bg-gray-200">
                    <div className="h-1.5 rounded-full bg-brand transition-all" style={{ width: `${v.progress}%` }} />
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
