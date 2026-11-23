import { FiFileText, FiLock, FiSmile, FiZap } from 'react-icons/fi';

const FEATURES = [
  {
    name: 'Private by default',
    description:
      'Files travel over encrypted connections and go straight to storage. Your original is deleted as soon as processing finishes.',
    icon: FiLock,
  },
  {
    name: 'Common formats',
    description: 'Upload MP4, MOV, MKV, WebM, AVI and more. Download as MP4, MOV or MKV.',
    icon: FiFileText,
  },
  {
    name: 'Real progress',
    description: 'Watch your video upload and process live, step by step. No guessing, no fake progress bars.',
    icon: FiZap,
  },
  {
    name: 'No sign-up needed',
    description: 'Use every tool without an account. Sign up for bigger files and a history of your past jobs.',
    icon: FiSmile,
  },
];

export function FeatureList() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-2xl lg:text-center">
        <h2 className="text-base font-semibold text-brand">Optimize your videos</h2>
        <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          All the tools you need to enhance your videos
        </p>
      </div>
      <dl className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-4xl lg:grid-cols-2 lg:gap-y-16">
        {FEATURES.map((f) => (
          <div key={f.name} className="relative pl-16">
            <dt className="text-xl font-semibold text-gray-900">
              <div className="absolute top-0 left-0 flex h-10 w-10 items-center justify-center rounded-lg bg-brand">
                <f.icon aria-hidden className="h-6 w-6 text-white" />
              </div>
              {f.name}
            </dt>
            <dd className="mt-2 text-lg leading-8 text-gray-600">{f.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
