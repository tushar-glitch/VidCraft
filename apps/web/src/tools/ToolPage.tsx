import { useState, type ReactNode } from 'react';
import { FiCheck, FiDownload, FiFileText, FiLoader, FiUpload, FiX } from 'react-icons/fi';
import { UPLOAD_LIMITS, type JobDto, type JobTask } from '@vidcraft/shared';
import { useAuth } from '../auth/AuthContext.tsx';
import { FeatureList } from '../components/FeatureList.tsx';
import { formatBytes } from '../lib/format.ts';
import { useVideoJob, type JobPhase } from './useVideoJob.ts';

interface ToolPageProps {
  title: string;
  subtitle: string;
  actionLabel: string;
  /** Settings form shown once a file is chosen. */
  options: ReactNode;
  /** Builds the task from the current settings. */
  getTask: () => JobTask;
  /** Extra result details, e.g. how much space was saved. */
  renderResult?: (job: JobDto) => ReactNode;
  onFileChange?: (file: File | null) => void;
}

const btn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-8 py-3 text-lg font-bold text-white shadow-lg hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50';

export function ToolPage({ title, subtitle, actionLabel, options, getTask, renderResult, onFileChange }: ToolPageProps) {
  const { user, openModal } = useAuth();
  const { phase, run, reset } = useVideoJob();
  const [file, setFile] = useState<File | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const limit = user ? UPLOAD_LIMITS.user : UPLOAD_LIMITS.anonymous;

  const choose = (f: File | null) => {
    setPickError(null);
    reset();
    if (f && f.size > limit) {
      setPickError(`This file is ${formatBytes(f.size)}; the limit is ${formatBytes(limit)}.`);
      f = null;
    }
    setFile(f);
    onFileChange?.(f);
  };

  const busy = phase.kind === 'uploading' || phase.kind === 'processing';

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-16">
      <div className="mb-12 w-full max-w-2xl text-center">
        <h1 className="mb-4 text-5xl font-bold text-gray-800 sm:text-6xl">{title}</h1>
        <p className="mb-8 text-xl text-gray-600">{subtitle}</p>

        {!file ? (
          <>
            <label className={`${btn} cursor-pointer`}>
              <FiUpload className="h-6 w-6" />
              Choose File
              <input type="file" accept="video/*" className="hidden" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
            </label>
            {pickError && <p className="mt-3 text-sm text-red-600">{pickError}</p>}
            <p className="mt-3 text-sm text-gray-600">
              Max file size {formatBytes(limit)}.
              {!user && (
                <>
                  {' '}
                  <button type="button" className="text-brand underline" onClick={() => openModal('signup')}>
                    Sign up
                  </button>{' '}
                  for {formatBytes(UPLOAD_LIMITS.user)}.
                </>
              )}
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-left shadow-md">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2 text-gray-700">
                <FiFileText className="shrink-0 text-gray-500" size={20} />
                <strong className="truncate font-medium">{file.name}</strong>
                <span className="shrink-0 text-sm text-gray-500">{formatBytes(file.size)}</span>
              </div>
              <button type="button" aria-label="Remove file" disabled={busy} onClick={() => choose(null)} className="text-gray-500 hover:text-gray-800 disabled:opacity-30">
                <FiX size={20} />
              </button>
            </div>

            {phase.kind === 'done' ? (
              <Result job={phase.job} extra={renderResult?.(phase.job)} onRestart={() => choose(null)} />
            ) : (
              <>
                <fieldset disabled={busy} className="space-y-4">
                  {options}
                </fieldset>
                {phase.kind !== 'idle' && <Progress phase={phase} />}
                <div className="mt-6 flex justify-center">
                  <button type="button" className={btn} disabled={busy} onClick={() => run(file, getTask())}>
                    {busy ? (
                      <>
                        Working <FiLoader className="h-5 w-5 animate-spin" />
                      </>
                    ) : phase.kind === 'error' ? (
                      'Try again'
                    ) : (
                      actionLabel
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <FeatureList />
    </div>
  );
}

function Progress({ phase }: { phase: JobPhase }) {
  if (phase.kind === 'error') {
    return <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{phase.message}</p>;
  }
  const step = phase.kind === 'uploading' ? 0 : 1;
  const queued = phase.kind === 'processing' && phase.job.status === 'queued';
  const pct = phase.kind === 'uploading' ? phase.pct : phase.kind === 'processing' ? phase.job.progress : 100;
  const label =
    phase.kind === 'uploading' ? `Uploading ${pct}%` : queued ? 'Waiting for a free worker…' : `Processing ${pct}%`;

  return (
    <div className="mt-5" aria-live="polite">
      <ol className="mb-2 flex gap-4 text-xs text-gray-500">
        {['Upload', 'Process', 'Ready'].map((name, i) => (
          <li key={name} className={i < step ? 'text-green-600' : i === step ? 'font-medium text-brand' : ''}>
            {i < step && <FiCheck className="mr-1 inline" />}
            {name}
          </li>
        ))}
      </ol>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div className="h-2 rounded-full bg-green-500 transition-all duration-500" style={{ width: `${queued ? 2 : pct}%` }} />
      </div>
      <p className="mt-1 text-sm text-gray-600">{label}</p>
    </div>
  );
}

function Result({ job, extra, onRestart }: { job: JobDto; extra: ReactNode; onRestart: () => void }) {
  return (
    <div className="text-center">
      <p className="mb-1 font-medium text-green-600">
        <FiCheck className="mr-1 inline" />
        Done! New size: <strong>{formatBytes(job.outputSize ?? 0)}</strong>
      </p>
      {extra}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <a href={job.downloadUrl ?? undefined} className={btn}>
          <FiDownload /> Download
        </a>
        <button type="button" onClick={onRestart} className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50">
          Process another
        </button>
      </div>
      <p className="mt-3 text-xs text-gray-500">The download link expires in an hour.</p>
    </div>
  );
}
