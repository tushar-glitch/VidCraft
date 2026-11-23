import { FiCheck } from 'react-icons/fi';

const PLANS = [
  { title: 'Basic', price: '9.99', maxFileSize: '1 GB', minutes: '1500', features: ['Use for Web and API', 'No ads', 'High priority'] },
  { title: 'Standard', price: '24.99', maxFileSize: '2 GB', minutes: '2000', features: ['Use for Web and API', 'No ads', 'High priority'] },
  { title: 'Pro', price: '29.99', maxFileSize: '5 GB', minutes: '4000', features: ['Use for Web and API', 'No ads', 'Highest priority'] },
];

export function Pricing() {
  return (
    <div className="flex flex-col items-center px-4 py-24">
      <h1 className="mb-4 text-center text-5xl font-bold text-gray-800 sm:text-6xl">Choose what suits you best!</h1>
      <p className="mb-12 text-center text-gray-600">
        Paid plans are coming soon. Every tool is free to use today.
      </p>
      <div className="grid w-full max-w-6xl gap-8 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div key={plan.title} className="rounded-lg border p-10 text-center shadow-md">
            <h2 className="mb-4 text-3xl font-semibold">{plan.title}</h2>
            <p className="mb-2 text-2xl font-bold text-blue-600">${plan.price} / month</p>
            <p className="mb-4 text-sm text-gray-500">(cancel any time)</p>
            <button type="button" disabled className="mb-6 cursor-not-allowed rounded bg-gray-300 px-4 py-2 text-white">
              Coming soon
            </button>
            <ul className="space-y-2 text-left">
              {[`${plan.maxFileSize} maximum file size`, `${plan.minutes} processing minutes / month`, ...plan.features].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <FiCheck className="shrink-0 text-green-600" /> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
