import { useEffect, useState } from 'react';
import type { JobDto, JobStatus } from '@vidcraft/shared';
import { api } from '../../lib/api.ts';
import { formatBytes, formatDate } from '../../lib/format.ts';
import { Panel } from './DashboardLayout.tsx';

const STATUS: Record<JobStatus, { label: string; className: string }> = {
  awaiting_upload: { label: 'Not uploaded', className: 'bg-gray-100 text-gray-600' },
  queued: { label: 'Queued', className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
};

function describe(job: JobDto): string {
  const { task } = job;
  return task.operation === 'compress'
    ? `Compress to ${task.params.targetPercent}% · ${task.params.codec.toUpperCase()} · ${task.params.format.toUpperCase()}`
    : `Resize to ${task.params.width}×${task.params.height} · ${task.params.format.toUpperCase()}`;
}

export function History() {
  const [jobs, setJobs] = useState<JobDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listJobs().then(setJobs, () => setError('Could not load your jobs. Please refresh.'));
  }, []);

  return (
    <Panel title="My jobs">
      {error && <p className="text-red-600">{error}</p>}
      {!jobs && !error && <p className="text-gray-500">Loading…</p>}
      {jobs?.length === 0 && <p className="text-gray-500">No jobs yet. Compress or resize a video and it will show up here.</p>}
      {jobs && jobs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-600 uppercase">
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Operation</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b align-top">
                  <td className="max-w-56 px-3 py-3">
                    <div className="truncate text-gray-800">{job.inputName}</div>
                    <div className="text-xs text-gray-500">{formatDate(job.createdAt)}</div>
                  </td>
                  <td className="px-3 py-3 text-gray-700">{describe(job)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-700">
                    {formatBytes(job.inputSize)}
                    {job.outputSize !== null && <> → {formatBytes(job.outputSize)}</>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[job.status].className}`} title={job.error ?? undefined}>
                      {STATUS[job.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {job.downloadUrl && (
                      <a href={job.downloadUrl} className="rounded-lg bg-brand px-4 py-1.5 text-white hover:bg-brand-dark">
                        Download
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
