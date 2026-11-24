import { useEffect, useRef, useState } from 'react';
import { createFeed, type FeedEvent } from '@vidcraft/sdk';

interface Stats {
  firstFrame: { ms: number; preloaded: boolean; height: number | null } | null;
  rebuffers: number;
  rebufferMs: number;
  qualityChanges: number;
  views: number;
}
const EMPTY: Stats = { firstFrame: null, rebuffers: 0, rebufferMs: 0, qualityChanges: 0, views: 0 };
const POOL_SIZE = 3;

/** VidCraft's own public feed, built on the same SDK that other sites would embed. */
export function Explore() {
  const mount = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<Stats>(EMPTY);

  useEffect(() => {
    const container = mount.current;
    if (!container) return;
    setStats(EMPTY);
    const feed = createFeed(container, {
      apiUrl: `${import.meta.env.VITE_API_URL ?? ''}/api/v1`,
      poolSize: POOL_SIZE,
      onEvent: (e: FeedEvent) =>
        setStats((s) => {
          switch (e.type) {
            case 'firstFrame':
              return { ...s, firstFrame: { ms: e.startupMs, preloaded: e.preloaded, height: e.quality } };
            case 'rebuffer':
              return { ...s, rebuffers: s.rebuffers + 1, rebufferMs: s.rebufferMs + e.durationMs };
            case 'qualityChange':
              return { ...s, qualityChanges: s.qualityChanges + 1 };
            case 'impression':
              return { ...s, views: s.views + 1 };
            default:
              return s;
          }
        }),
    });
    return () => feed.destroy();
  }, []);

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center gap-10 bg-neutral-900 p-4">
      <div
        ref={mount}
        data-testid="feed"
        className="aspect-[9/16] h-[min(85svh,820px)] overflow-hidden rounded-2xl shadow-2xl max-sm:aspect-auto max-sm:h-[calc(100svh-6rem)] max-sm:w-full"
      />
      <aside className="hidden w-64 text-sm text-neutral-300 lg:block" data-testid="stats">
        <h2 className="mb-3 text-base font-semibold text-white">Live playback stats</h2>
        <dl className="space-y-3">
          <Stat label="Time to first frame">
            {stats.firstFrame ? (
              <>
                <b className="text-white">{stats.firstFrame.ms} ms</b>{' '}
                <span className={stats.firstFrame.preloaded ? 'text-green-400' : 'text-yellow-400'}>
                  {stats.firstFrame.preloaded ? 'preloaded' : 'cold start'}
                </span>
              </>
            ) : (
              '—'
            )}
          </Stat>
          <Stat label="Quality playing">{stats.firstFrame?.height ? `${stats.firstFrame.height}p` : "—"}</Stat>
          <Stat label="Rebuffers">
            {stats.rebuffers} {stats.rebuffers > 0 && `(${stats.rebufferMs} ms)`}
          </Stat>
          <Stat label="Quality switches">{stats.qualityChanges}</Stat>
          <Stat label="Videos viewed">{stats.views}</Stat>
          <Stat label="Players in use">{POOL_SIZE} (reused as you swipe)</Stat>
        </dl>
        <p className="mt-6 text-xs text-neutral-500">
          Swipe, scroll or use ↑ ↓. Publish a video from your dashboard to see it here.
        </p>
      </aside>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
