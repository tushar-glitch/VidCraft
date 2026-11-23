import { useState } from 'react';
import type { ParamsOf } from '@vidcraft/shared';
import { Field, FORMAT_OPTIONS, Select } from './fields.tsx';
import { ToolPage } from './ToolPage.tsx';

type Params = ParamsOf<'compress'>;

export function CompressPage() {
  const [params, setParams] = useState<Params>({ targetPercent: 50, format: 'mp4', codec: 'h264' });
  const set = (patch: Partial<Params>) => setParams((p) => ({ ...p, ...patch }));

  return (
    <ToolPage
      title="Compress Video"
      subtitle="Reduce the file size of your videos"
      actionLabel="Compress Now"
      getTask={() => ({ operation: 'compress', params })}
      renderResult={(job) => {
        const saved = Math.round((1 - (job.outputSize ?? 0) / job.inputSize) * 100);
        return saved > 0 ? (
          <p className="text-sm text-gray-600">That's {saved}% smaller than the original 🥳</p>
        ) : (
          <p className="text-sm text-gray-600">This video was already well compressed, so the size barely changed.</p>
        );
      }}
      options={
        <>
          <Field label={`Target quality: ${params.targetPercent}% of the original bitrate`} hint="Lower = smaller file, lower quality.">
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={params.targetPercent}
              onChange={(e) => set({ targetPercent: Number(e.target.value) })}
              className="w-full accent-brand"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Output format">
              <Select value={params.format} onChange={(format) => set({ format })} options={FORMAT_OPTIONS} />
            </Field>
            <Field label="Video codec" hint="H.265 is smaller but plays on fewer devices.">
              <Select
                value={params.codec}
                onChange={(codec) => set({ codec })}
                options={[
                  { value: 'h264', label: 'H.264 (most compatible)' },
                  { value: 'h265', label: 'H.265 / HEVC' },
                ]}
              />
            </Field>
          </div>
        </>
      }
    />
  );
}
