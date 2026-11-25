import { useState } from 'react';
import type { BenchmarkResultDto, BenchRow } from '@vidcraft/shared';
import { RelativeBars, type RelativeBar } from '../components/charts/RelativeBars.tsx';
import result from '../data/benchmark.json';
import { formatMs, formatPercent } from '../lib/format.ts';

const data = result as BenchmarkResultDto;
const IMPL = { sdk: 'VidCraft SDK', naive: 'Baseline feed' } as const;

type Measure = 'swipe' | 'cold';
type Statistic = 'medianMs' | 'p95Ms';

const MEASURES: { id: Measure; label: string; what: string }[] = [
  { id: 'swipe', label: 'Swiping to the next video', what: 'from the swipe to the first moving picture' },
  { id: 'cold', label: 'First video of a visit', what: 'from opening the feed to the first moving picture' },
];
const STATISTICS: { id: Statistic; label: string }[] = [
  { id: 'medianMs', label: 'Typical (median)' },
  { id: 'p95Ms', label: 'Slow tail (95th percentile)' },
];

const find = (network: string, impl: BenchRow['impl']) => data.rows.find((r) => r.network === network && r.impl === impl);

export function Benchmarks() {
  const [measure, setMeasure] = useState<Measure>('swipe');
  const [statistic, setStatistic] = useState<Statistic>('medianMs');

  const pairs = data.networks.flatMap((network) => {
    const sdk = find(network.id, 'sdk');
    const naive = find(network.id, 'naive');
    return sdk && naive ? [{ network, sdk, naive }] : [];
  });

  const bars: RelativeBar[] = pairs.map(({ network, sdk, naive }) => {
    const a = sdk[measure][statistic];
    const b = naive[measure][statistic];
    return {
      key: network.id,
      label: network.label,
      detail: `SDK ${formatMs(a)}  ·  baseline ${formatMs(b)}`,
      ratio: a / b,
      tip: [`VidCraft SDK: ${formatMs(a)} (${sdk[measure].n} measurements)`, `Baseline feed: ${formatMs(b)} (${naive[measure].n} measurements)`],
    };
  });

  // Where the two differ most, in plain numbers.
  const biggest = [...pairs].sort((p, q) => Math.abs(q.naive.swipe.medianMs - q.sdk.swipe.medianMs) - Math.abs(p.naive.swipe.medianMs - p.sdk.swipe.medianMs))[0];
  // The results are not one-sided, and the headline must not pretend otherwise.
  const coldBaselineWins = pairs.filter((p) => p.naive.cold.medianMs < p.sdk.cold.medianMs).length;
  const stallsMoreWith = pairs.filter((p) => p.sdk.stalledShare > p.naive.stalledShare).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-bold text-gray-800">Benchmarks</h1>
      <p className="mt-3 text-lg text-gray-600">
        How quickly does the next video start? The VidCraft SDK against a plain feed, in the same browser, on the same videos, under the same emulated networks.
      </p>
      {biggest && (
        <div className="mt-4 space-y-2 rounded-lg bg-blue-50 p-4 text-gray-800">
          <p>
            On <b>{biggest.network.label}</b>, the median swipe starts in <b>{formatMs(biggest.sdk.swipe.medianMs)}</b> with the SDK and <b>{formatMs(biggest.naive.swipe.medianMs)}</b> with the baseline feed.
          </p>
          {(coldBaselineWins > 0 || stallsMoreWith > 0) && (
            <p className="text-sm">
              It is not better at everything.
              {coldBaselineWins > 0 && <> The <b>first video</b> of a visit starts faster with the baseline on {coldBaselineWins} of {pairs.length} networks.</>}
              {stallsMoreWith > 0 && <> The SDK's videos <b>stall more often</b> in the first seconds on {stallsMoreWith} of {pairs.length} networks.</>}
              {' '}Both are in the numbers below and explained under “Read it with care”.
            </p>
          )}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-gray-800">How long until the picture moves</h2>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Segmented label="Measure" value={measure} options={MEASURES} onChange={setMeasure} />
          <Segmented label="Statistic" value={statistic} options={STATISTICS} onChange={setStatistic} />
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Time {MEASURES.find((m) => m.id === measure)!.what}. Each bar is the SDK's time as a share of the baseline's on that network: <b>below 100% means the SDK is faster</b>, above 100% means the baseline is. Lower is better.
        </p>
        <div className="mt-4">
          <RelativeBars bars={bars} title={`SDK ${statistic === 'medianMs' ? 'median' : '95th percentile'} time as a share of the baseline's, for each network`} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-gray-800">All the numbers</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-600 uppercase">
                <th className="py-2 pr-3 font-medium">Network</th>
                <th className="py-2 pr-3 font-medium">Feed</th>
                <th className="py-2 pr-3 font-medium">First video<br /><span className="font-normal normal-case">median / slow tail</span></th>
                <th className="py-2 pr-3 font-medium">Each swipe<br /><span className="font-normal normal-case">median / slow tail</span></th>
                <th className="py-2 pr-3 font-medium">Swipes that stalled</th>
                <th className="py-2 pr-3 font-medium">Video data per view</th>
                <th className="py-2 font-medium">Starting quality</th>
              </tr>
            </thead>
            <tbody>
              {pairs.flatMap(({ network, sdk, naive }) =>
                ([sdk, naive] as const).map((row, i) => {
                  const other = i === 0 ? naive : sdk;
                  // The better of the two is bold. A tie is bold on neither.
                  const best = (pick: (r: BenchRow) => number) => (pick(row) < pick(other) ? 'font-semibold text-gray-900' : '');
                  return (
                    <tr key={`${network.id}-${row.impl}`} className={`align-top ${i === 1 ? 'border-b' : ''}`}>
                      <td className="py-2 pr-3 text-gray-800">{i === 0 && network.label}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{IMPL[row.impl]}</td>
                      <td className="py-2 pr-3 whitespace-nowrap tabular-nums"><span className={best((r) => r.cold.medianMs)}>{formatMs(row.cold.medianMs)}</span> / {formatMs(row.cold.p95Ms)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap tabular-nums"><span className={best((r) => r.swipe.medianMs)}>{formatMs(row.swipe.medianMs)}</span> / {formatMs(row.swipe.p95Ms)}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        <span className={best((r) => r.stalledShare)}>{formatPercent(row.stalledShare)}</span>
                        {row.stallMsMedian !== null && <span className="text-xs text-gray-500"> (median {formatMs(row.stallMsMedian)})</span>}
                      </td>
                      <td className="py-2 pr-3 tabular-nums"><span className={best((r) => r.megabytesPerView)}>{row.megabytesPerView.toFixed(2)} MB</span></td>
                      <td className="py-2 tabular-nums">{row.qualityMedian ? `${row.qualityMedian}p` : '—'}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Bold marks the better of each pair. {data.reps} sessions per cell, each a first video then {data.swipesPerSession} swipes, so the first-video numbers come from {data.reps} measurements and the swipe numbers from {data.reps * data.swipesPerSession}. A video that never played counts as 90 seconds and is reported as a failure, not dropped.
          {data.rows.some((r) => r.timeouts > 0) && ` Videos that never played: ${data.rows.filter((r) => r.timeouts > 0).map((r) => `${IMPL[r.impl]} on ${data.networks.find((n) => n.id === r.network)?.label} (${r.timeouts})`).join(', ')}.`}
        </p>
      </section>

      <section className="mt-12 space-y-4 text-gray-700">
        <h2 className="text-2xl font-semibold text-gray-800">What was compared</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li><b>VidCraft SDK:</b> the feed from <code>@vidcraft/sdk</code>. It reuses a small pool of players, loads the next video in the background, starts the next video as the swipe begins, remembers the viewer's connection speed, and never fetches a picture larger than the screen.</li>
          <li><b>Baseline feed:</b> a vertical feed the way most developers write it the first time. Each video gets its own <code>&lt;video&gt;</code> and its own hls.js player, created when the video is mostly on screen and thrown away when it leaves, with hls.js's default settings. It uses the <i>same video engine</i> (the light build of hls.js), the <i>same videos</i> and the same playlists, so any difference comes from how the players are managed, not from a different player.</li>
        </ul>
        <h2 className="pt-4 text-2xl font-semibold text-gray-800">How it was measured</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Real Chrome ({data.chrome.split('.')[0]}), emulating a phone ({data.viewport.width}×{data.viewport.height} at {data.viewport.deviceScaleFactor}× resolution), driven by an automated script. Every session starts with an empty browser profile: no cache, no remembered connection speed.</li>
          <li>Networks are emulated with Chrome's throttling: a download speed limit plus a delay added to every request. The page itself loads first at full speed, as it would for a viewer already in the app.</li>
          <li>One meter, outside both feeds, times each video from the moment of the swipe to the first moving picture, then counts stalls over the next {data.watchMs / 1000} seconds. The same code measures both, so neither feed grades itself.</li>
          <li>The two feeds take turns going first, one unmeasured warm-up session runs before the real ones, and the machine rests between sessions: back-to-back sessions disturb each other.</li>
        </ul>
        <h2 className="pt-4 text-2xl font-semibold text-gray-800">Read it with care</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li><b>The first video is slower with the SDK.</b> Opening the feed, the SDK also starts loading the next and previous videos straight away. On a slow connection that probably competes with the first video for bandwidth, though this has not been tested. Loading the neighbours only once the first video is playing is the likely fix, and has not been done yet.</li>
          <li><b>The SDK trades smoothness for speed on slow connections.</b> It starts the next video at once from a short preloaded buffer, so on a connection that cannot keep up it can stall in the first seconds; the baseline waits longer to start and then plays steadily. How much to preload for a given connection speed is the next thing to tune.</li>
          <li>These are emulated networks, not real mobile ones, and the videos are served from the same machine, so there is no CDN and no distance. Real networks are messier.</li>
          <li>The samples are small. Where the two feeds are within a few tens of milliseconds, treat it as a tie.</li>
          <li>Every session is a first visit. The SDK remembers connection speed between visits, which would help returning viewers; that isn't measured here.</li>
          <li>A start includes about 100 ms that the browser itself needs to show the first frame of a video that has been told to play. No feed can remove that, which is why the fast networks look alike.</li>
          <li>The test videos are a handful of 8-second, 720×1280 clips.</li>
        </ul>
        <h2 className="pt-4 text-2xl font-semibold text-gray-800">Run it yourself</h2>
        <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"><code>{`# the API running, with at least 6 published videos, and Chrome installed
npm run bench -w @vidcraft/bench -- --reps ${data.reps}`}</code></pre>
        <p className="text-sm text-gray-500">
          This run: {new Date(data.generatedAt).toLocaleDateString(undefined, { dateStyle: 'long' })}, Chrome {data.chrome}, {data.platform}.
        </p>
      </section>
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="text-gray-600">{label}</span>
      <div className="flex overflow-hidden rounded-md border border-gray-300">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={`px-3 py-1.5 ${value === o.id ? 'bg-blue-50 font-medium text-brand' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
