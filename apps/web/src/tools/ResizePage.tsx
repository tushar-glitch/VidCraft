import { useState } from 'react';
import type { VideoFormat } from '@vidcraft/shared';
import { Field, FORMAT_OPTIONS, inputClass, Select } from './fields.tsx';
import { ToolPage } from './ToolPage.tsx';

const PRESETS = {
  widescreen: { label: 'Widescreen 16:9 (1280×720)', width: 1280, height: 720 },
  vertical: { label: 'Vertical 9:16 (720×1280)', width: 720, height: 1280 },
  square: { label: 'Square 1:1 (720×720)', width: 720, height: 720 },
  portrait: { label: 'Portrait 4:5 (800×1000)', width: 800, height: 1000 },
  tall: { label: 'Portrait 2:3 (800×1200)', width: 800, height: 1200 },
  custom: { label: 'Custom size', width: 0, height: 0 },
} as const;
type Preset = keyof typeof PRESETS;
const PRESET_OPTIONS = Object.entries(PRESETS).map(([value, p]) => ({ value: value as Preset, label: p.label }));

const clampDim = (n: number) => Math.min(3840, Math.max(16, Math.round(n) || 16));

/** Reads a local video's dimensions in the browser, without uploading it. */
function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      reject(new Error('Could not read video'));
      URL.revokeObjectURL(url);
    };
    video.src = url;
  });
}

export function ResizePage() {
  const [preset, setPreset] = useState<Preset>('widescreen');
  const [custom, setCustom] = useState({ width: 1080, height: 1920 });
  const [format, setFormat] = useState<VideoFormat>('mp4');
  const [source, setSource] = useState<{ width: number; height: number } | null>(null);

  const size = preset === 'custom' ? custom : PRESETS[preset];

  return (
    <ToolPage
      title="Resize Video"
      subtitle="Change the dimensions of your videos"
      actionLabel="Resize Now"
      onFileChange={(file) => {
        setSource(null);
        // Not every format can be previewed by the browser; the size is just shown for reference.
        if (file) readDimensions(file).then(setSource, () => {});
      }}
      getTask={() => ({
        operation: 'resize',
        params: { width: clampDim(size.width), height: clampDim(size.height), format },
      })}
      renderResult={() => (
        <p className="text-sm text-gray-600">
          Resized to {clampDim(size.width)}×{clampDim(size.height)}
        </p>
      )}
      options={
        <>
          {source && (
            <p className="text-sm text-gray-600">
              Original size: <strong>{source.width}×{source.height}</strong>
            </p>
          )}
          <Field label="Size">
            <Select value={preset} onChange={setPreset} options={PRESET_OPTIONS} />
          </Field>
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              {(['width', 'height'] as const).map((dim) => (
                <Field key={dim} label={`${dim === 'width' ? 'Width' : 'Height'} (px)`}>
                  <input
                    type="number"
                    min={16}
                    max={3840}
                    value={custom[dim]}
                    onChange={(e) => setCustom((c) => ({ ...c, [dim]: Number(e.target.value) }))}
                    onBlur={() => setCustom((c) => ({ ...c, [dim]: clampDim(c[dim]) }))}
                    className={inputClass}
                  />
                </Field>
              ))}
            </div>
          )}
          <Field label="Output format">
            <Select value={format} onChange={setFormat} options={FORMAT_OPTIONS} />
          </Field>
        </>
      }
    />
  );
}
