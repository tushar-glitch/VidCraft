import { useCallback, useEffect, useRef, useState } from 'react';
import type { JobDto, JobTask } from '@vidcraft/shared';
import { api, ApiError, uploadFile } from '../lib/api.ts';

export type JobPhase =
  | { kind: 'idle' }
  | { kind: 'uploading'; pct: number }
  | { kind: 'processing'; job: JobDto }
  | { kind: 'done'; job: JobDto }
  | { kind: 'error'; message: string };

const POLL_MS = 1000;
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => clearTimeout(t), { once: true });
  });

/**
 * Runs one video job end to end: create → upload to storage → start → poll until finished.
 * Every tool page uses this; only the task (operation + params) differs.
 */
export function useVideoJob() {
  const [phase, setPhase] = useState<JobPhase>({ kind: 'idle' });
  const controller = useRef<AbortController | null>(null);

  // Stop polling and uploads when the page unmounts.
  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(async (file: File, task: JobTask) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const { signal } = ctrl;

    try {
      setPhase({ kind: 'uploading', pct: 0 });
      const { job, uploadUrl } = await api.createJob({ fileName: file.name, fileSize: file.size, task });
      await uploadFile(uploadUrl, file, (pct) => !signal.aborted && setPhase({ kind: 'uploading', pct }), signal);

      let current = await api.startJob(job.id);
      while (!signal.aborted) {
        if (current.status === 'completed') return setPhase({ kind: 'done', job: current });
        if (current.status === 'failed') {
          return setPhase({ kind: 'error', message: current.error ?? 'Processing failed. Please try another file.' });
        }
        setPhase({ kind: 'processing', job: current });
        await sleep(POLL_MS, signal);
        if (!signal.aborted) current = await api.getJob(job.id);
      }
    } catch (err) {
      if (signal.aborted) return;
      setPhase({ kind: 'error', message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    }
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    setPhase({ kind: 'idle' });
  }, []);

  return { phase, run, reset };
}
