import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';

interface Level {
  height: number;
  width: number;
  bitrate: number;
}

const label = (l: Level) => `${Math.min(l.width, l.height)}p`;

/** Plays an HLS stream with adaptive quality, and lets you pin a quality for testing. */
export function HlsPlayer({ src, poster }: { src: string; poster?: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selected, setSelected] = useState(-1); // -1 = automatic
  const [playing, setPlaying] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setLevels([]);
    setSelected(-1);

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => setLevels(data.levels as Level[]));
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setPlaying(data.level));
      hls.on(Hls.Events.ERROR, (_e, data) => data.fatal && setError('Could not play this video.'));
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }
    // Safari plays HLS natively.
    if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = src;
    else setError('This browser cannot play HLS video.');
  }, [src]);

  const choose = (level: number) => {
    setSelected(level);
    if (hlsRef.current) hlsRef.current.currentLevel = level; // -1 returns to automatic
  };

  return (
    <div>
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        controls
        playsInline
        muted
        className="max-h-[70vh] w-full rounded-lg bg-black"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {levels.length > 0 && (
        <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
          <label className="flex items-center gap-2">
            Quality
            <select
              value={selected}
              onChange={(e) => choose(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-2 py-1"
              aria-label="Quality"
            >
              <option value={-1}>Auto</option>
              {/* hls.js lists qualities lowest first; show the best first, keeping each one's own index as its value. */}
              {levels
                .map((l, i) => ({ l, i }))
                .reverse()
                .map(({ l, i }) => (
                  <option key={i} value={i}>
                    {label(l)}
                  </option>
                ))}
            </select>
          </label>
          <span data-testid="playing-quality">Playing: {playing >= 0 && levels[playing] ? label(levels[playing]) : '…'}</span>
        </div>
      )}
    </div>
  );
}
