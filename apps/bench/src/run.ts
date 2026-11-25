// Benchmark runner: builds the two pages, then drives Chrome through each network profile with each
// implementation, alternating who goes first, and writes the results.
//
//   npm run bench -w @vidcraft/bench -- --reps 3
//
// Needs the API running with at least 6 published videos, and Chrome installed.
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium, type Browser } from 'playwright-core';
import { build, preview } from 'vite';
import type { BenchmarkResultDto, BenchRow } from '@vidcraft/shared';
import { aggregate, type SessionResult } from './aggregate.ts';
import { SWIPES, WATCH_MS } from './constants.ts';
import type { BenchApi } from './harness.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2 }; // a phone

interface Network {
  id: string;
  label: string;
  downKbps: number | null;
  latencyMs: number;
}
// Emulated with Chrome's DevTools network throttling: bandwidth plus a delay added to every request.
const NETWORKS: Network[] = [
  { id: 'fast', label: 'Fast (no limit)', downKbps: null, latencyMs: 0 },
  { id: '4g', label: '4G: 9 Mbit/s, 70 ms', downKbps: 9000, latencyMs: 70 },
  { id: 'slow-4g', label: 'Slow 4G: 1.6 Mbit/s, 150 ms', downKbps: 1600, latencyMs: 150 },
  { id: '3g', label: '3G: 0.4 Mbit/s, 400 ms', downKbps: 400, latencyMs: 400 },
];
const IMPLS = ['sdk', 'naive'] as const;

const { values: args } = parseArgs({
  options: {
    reps: { type: 'string', default: '3' },
    networks: { type: 'string', default: NETWORKS.map((n) => n.id).join(',') },
    api: { type: 'string', default: 'http://localhost:4000/api/v1' },
    port: { type: 'string', default: '5199' },
    'no-publish': { type: 'boolean', default: false },
  },
});
const reps = Number(args.reps);
const apiUrl = args.api!;
const networks = NETWORKS.filter((n) => args.networks!.split(',').includes(n.id));
if (!Number.isInteger(reps) || reps < 1) throw new Error('--reps must be a positive whole number');
if (networks.length === 0) throw new Error(`--networks must include one of: ${NETWORKS.map((n) => n.id).join(', ')}`);

async function checkFeed() {
  const res = await fetch(`${apiUrl}/feed?limit=10`).catch(() => null);
  const items = res?.ok ? ((await res.json()) as { items: unknown[] }).items : [];
  if (items.length < SWIPES + 1) {
    throw new Error(`The feed at ${apiUrl} has ${items.length} videos; the benchmark needs ${SWIPES + 1}. Start the API and publish some videos.`);
  }
}

async function runSession(browser: Browser, base: string, impl: (typeof IMPLS)[number], network: Network): Promise<SessionResult> {
  // A fresh browser context every time: empty HTTP cache, no remembered bandwidth.
  const context = await browser.newContext({ viewport: { width: VIEWPORT.width, height: VIEWPORT.height }, deviceScaleFactor: VIEWPORT.deviceScaleFactor, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    // Load the page first, unthrottled: a real viewer's app is already loaded when they open the feed.
    await page.goto(`${base}/${impl}.html?api=${encodeURIComponent(apiUrl)}`);
    await page.waitForFunction(() => window.__bench);

    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    const urls = new Map<string, string>();
    let bytes = 0;
    cdp.on('Network.requestWillBeSent', (e) => urls.set(e.requestId, e.request.url));
    cdp.on('Network.loadingFinished', (e) => {
      if (urls.get(e.requestId)?.includes('/hls/')) bytes += e.encodedDataLength; // video playlists, chunks and init files
    });
    if (network.downKbps !== null) {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: network.latencyMs,
        downloadThroughput: (network.downKbps * 1000) / 8,
        uploadThroughput: (network.downKbps * 1000) / 8 / 2,
      });
    }

    const cold = await page.evaluate(() => window.__bench!.coldStart());
    const swipes = [];
    for (let i = 1; i <= SWIPES; i++) swipes.push(await page.evaluate((index) => window.__bench!.swipe(index), i));
    return { cold, swipes, bytes };
  } finally {
    await context.close();
  }
}

await checkFeed();
console.log('Building the benchmark pages…');
await build({ root, logLevel: 'warn', build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: { sdk: path.join(root, 'sdk.html'), naive: path.join(root, 'naive.html') } } } });
const server = await preview({ root, logLevel: 'warn', preview: { port: Number(args.port), strictPort: true } });
const base = `http://localhost:${args.port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });

// A browser's first session pays one-time costs (starting its GPU and video decoder processes). Run each
// implementation once, unmeasured, so that cost lands on neither of them.
console.log('Warm-up (not measured)…');
for (const impl of IMPLS) await runSession(browser, base, impl, NETWORKS[0]!);

const sessions = new Map<string, SessionResult[]>();
const total = reps * networks.length * IMPLS.length;
let done = 0;
const started = Date.now();
try {
  for (let rep = 1; rep <= reps; rep++) {
    for (const network of networks) {
      // Alternate who goes first, so neither implementation always benefits from (or suffers) the machine's state.
      const order = rep % 2 ? IMPLS : [...IMPLS].reverse();
      for (const impl of order) {
        let result: SessionResult | null = null;
        for (let attempt = 1; attempt <= 2 && !result; attempt++) {
          try {
            result = await runSession(browser, base, impl, network);
          } catch (err) {
            console.warn(`  ${impl} on ${network.id} failed (attempt ${attempt}): ${(err as Error).message.split('\n')[0]}`);
          }
        }
        if (!result) throw new Error(`Giving up: ${impl} on ${network.id} failed twice`);
        // Back-to-back sessions disturb each other: whichever ran second was consistently slower. Let the machine settle.
        await new Promise((resolve) => setTimeout(resolve, 4000));
        const key = `${network.id}/${impl}`;
        sessions.set(key, [...(sessions.get(key) ?? []), result]);
        done++;
        const swipeMedian = [...result.swipes.map((s) => s.startMs ?? -1)].sort((a, b) => a - b)[Math.floor(SWIPES / 2)];
        console.log(`[${done}/${total}] rep ${rep} ${network.id.padEnd(8)} ${impl.padEnd(6)} cold ${String(result.cold.startMs).padStart(6)} ms  median swipe ${String(swipeMedian).padStart(6)} ms  ${((Date.now() - started) / 60000).toFixed(1)} min`);
      }
    }
  }
} finally {
  const chromeVersion = browser.version();
  await browser.close();
  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));

  const rows: BenchRow[] = networks.flatMap((n) => IMPLS.map((impl) => aggregate(n.id, impl, sessions.get(`${n.id}/${impl}`) ?? [])).filter((r) => r.cold.n > 0));
  if (rows.length === networks.length * IMPLS.length) {
    const result: BenchmarkResultDto = {
      generatedAt: new Date().toISOString(),
      chrome: chromeVersion,
      platform: `${os.type()} ${os.release()}, ${os.cpus().length} cores`,
      reps,
      swipesPerSession: SWIPES,
      watchMs: WATCH_MS,
      viewport: VIEWPORT,
      networks: networks.map(({ id, label, downKbps, latencyMs }) => ({ id, label, downKbps, latencyMs })),
      rows,
    };
    await mkdir(path.join(root, 'results'), { recursive: true });
    const file = path.join(root, 'results', `${result.generatedAt.replace(/[:.]/g, '-')}.json`);
    await writeFile(file, JSON.stringify(result, null, 2));
    if (!args['no-publish']) {
      const published = path.resolve(root, '../web/src/data/benchmark.json');
      await mkdir(path.dirname(published), { recursive: true });
      await copyFile(file, published);
      console.log(`Published to ${path.relative(process.cwd(), published)}`);
    }
    console.log(`\nResults: ${path.relative(process.cwd(), file)}\n`);
    console.table(rows.map((r) => ({ network: r.network, impl: r.impl, 'cold p50': r.cold.medianMs, 'swipe p50': r.swipe.medianMs, 'swipe p95': r.swipe.p95Ms, 'stalled %': Math.round(r.stalledShare * 100), timeouts: r.timeouts, 'MB/view': r.megabytesPerView, quality: r.qualityMedian })));
  } else {
    console.error('Run was incomplete, so no results were written.');
    process.exitCode = 1;
  }
}
