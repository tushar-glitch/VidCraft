import { useEffect, useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { Link, useNavigate, useParams } from 'react-router';
import type { VideoDto } from '@vidcraft/shared';
import { HlsPlayer } from '../../components/HlsPlayer.tsx';
import { api, ApiError } from '../../lib/api.ts';
import { formatBytes, formatDate } from '../../lib/format.ts';
import { Panel } from './DashboardLayout.tsx';
import { formatDuration, STATUS_STYLE } from './Videos.tsx';

export function VideoDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoDto | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    // Poll until it finishes converting, so the page shows the result without a refresh.
    const load = async () => {
      try {
        const v = await api.getVideo(id);
        if (cancelled) return;
        setVideo(v);
        setTitle((t) => t || v.title);
        if (v.status === 'queued' || v.status === 'processing' || v.status === 'awaiting_upload') timer = setTimeout(load, 1500);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError && err.status === 404 ? 'Video not found.' : 'Could not load this video.');
      }
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !video) {
    return (
      <Panel title="Video">
        <p className="text-red-600">{error}</p>
        <Link to="/dashboard/videos" className="mt-4 inline-block text-brand underline">Back to videos</Link>
      </Panel>
    );
  }
  if (!video) return <Panel title="Video"><p className="text-gray-500">Loading…</p></Panel>;

  const style = STATUS_STYLE[video.status];
  const dirty = title.trim() !== video.title && title.trim().length > 0;

  return (
    <Panel title={video.title}>
      <Link to="/dashboard/videos" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-brand">
        <FiArrowLeft /> All videos
      </Link>
      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-8 md:grid-cols-[minmax(0,320px)_1fr]">
        <div>
          {video.status === 'ready' && video.streamingUrl ? (
            <HlsPlayer src={video.streamingUrl} poster={video.thumbnailUrl} />
          ) : (
            <div className="flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-lg bg-gray-100 p-4 text-center text-gray-600">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
              {video.status === 'processing' && <span>{video.progress}%</span>}
              {video.status === 'failed' && <span className="text-sm text-red-700">{video.error}</span>}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => setVideo(await api.updateVideo(video.id, { title: title.trim() })));
            }}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              aria-label="Title"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:ring-2 focus:ring-brand focus:outline-none"
            />
            <button type="submit" disabled={!dirty || busy} className="rounded-md bg-brand px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-50">
              Save
            </button>
          </form>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-gray-500">Status</dt>
            <dd><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span></dd>
            <dt className="text-gray-500">Uploaded</dt>
            <dd>{formatDate(video.createdAt)}</dd>
            <dt className="text-gray-500">Original</dt>
            <dd>{video.sourceName} · {formatBytes(video.sourceSize)}</dd>
            {video.durationSec !== null && (
              <>
                <dt className="text-gray-500">Duration</dt>
                <dd>{formatDuration(video.durationSec)}</dd>
              </>
            )}
            {video.width && video.height && (
              <>
                <dt className="text-gray-500">Picture</dt>
                <dd>{video.width}×{video.height} ({video.aspectRatio})</dd>
              </>
            )}
          </dl>

          {video.renditions.length > 0 && (
            <div>
              <h3 className="mb-2 font-medium">Streaming qualities</h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-600 uppercase">
                    <th className="py-1 font-medium">Quality</th>
                    <th className="py-1 font-medium">Size</th>
                    <th className="py-1 font-medium">Video bitrate</th>
                  </tr>
                </thead>
                <tbody>
                  {video.renditions.map((r) => (
                    <tr key={r.name} className="border-b">
                      <td className="py-1.5">{r.name}</td>
                      <td className="py-1.5">{r.width}×{r.height}</td>
                      <td className="py-1.5">{(r.videoKbps / 1000).toFixed(1)} Mbit/s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {video.status === 'ready' && video.streamingUrl && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Stream URL (HLS)</span>
              <input readOnly value={video.streamingUrl} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs" />
            </label>
          )}

          <div className="flex flex-wrap gap-3 border-t pt-4">
            {video.status === 'ready' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => act(async () => setVideo(await api.updateVideo(video.id, { publishStatus: video.publishStatus === 'published' ? 'unpublished' : 'published' })))}
                className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
              >
                {video.publishStatus === 'published' ? 'Unpublish' : 'Publish'}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm('Delete this video and all its files? This cannot be undone.')) return;
                act(async () => {
                  await api.deleteVideo(video.id);
                  navigate('/dashboard/videos');
                });
              }}
              className="rounded-md border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
            {video.status === 'ready' && (
              <span className="self-center text-sm text-gray-500">
                {video.publishStatus === 'published' ? 'Published: will appear in feeds' : 'Unpublished: hidden from feeds'}
              </span>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
