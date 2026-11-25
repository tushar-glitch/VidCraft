import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { FiCopy, FiX } from 'react-icons/fi';
import { Link } from 'react-router';
import { MAX_WEBHOOKS_PER_USER, type WebhookDeliveryDto, type WebhookEndpointDto } from '@vidcraft/shared';
import { api, ApiError } from '../../lib/api.ts';
import { formatDate } from '../../lib/format.ts';
import { Panel } from './DashboardLayout.tsx';

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');

export function Webhooks() {
  const [endpoints, setEndpoints] = useState<WebhookEndpointDto[] | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newSecret, setNewSecret] = useState<{ url: string; secret: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(() => api.listWebhooks().then(setEndpoints, () => setError('Could not load your webhooks. Please refresh.')), []);
  useEffect(() => void refresh(), [refresh]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api.createWebhook(url.trim());
      setNewSecret({ url: created.url, secret: created.secret! });
      setUrl('');
      await refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(endpoint: WebhookEndpointDto) {
    if (!window.confirm(`Stop sending webhooks to ${endpoint.url}?`)) return;
    setError(null);
    try {
      await api.deleteWebhook(endpoint.id);
      if (openId === endpoint.id) setOpenId(null);
      await refresh();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Panel title="Webhooks">
        <p className="mb-4 text-sm text-gray-600">
          VidCraft sends a signed <code className="rounded bg-gray-100 px-1">POST</code> to your URL when a video finishes converting (<code className="rounded bg-gray-100 px-1">video.ready</code>) or fails (<code className="rounded bg-gray-100 px-1">video.failed</code>).
          Failed deliveries are retried for several minutes. <Link to="/docs#webhooks" className="text-brand underline">How to verify the signature</Link>.
        </p>

        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.example.com/vidcraft-webhook"
            aria-label="Webhook URL"
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:ring-2 focus:ring-brand focus:outline-none"
          />
          <button type="submit" disabled={busy || (endpoints?.length ?? 0) >= MAX_WEBHOOKS_PER_USER} className="rounded-md bg-brand px-5 py-2 whitespace-nowrap text-white hover:bg-brand-dark disabled:opacity-50">
            Add webhook
          </button>
        </form>
        {(endpoints?.length ?? 0) >= MAX_WEBHOOKS_PER_USER && <p className="mt-2 text-xs text-gray-500">You can have up to {MAX_WEBHOOKS_PER_USER} webhooks.</p>}
        {error && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {newSecret && (
          <div role="status" className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-amber-900">Copy the signing secret for {newSecret.url} now. It won't be shown again.</p>
              <button type="button" aria-label="Dismiss" onClick={() => setNewSecret(null)} className="text-amber-700 hover:text-amber-900"><FiX /></button>
            </div>
            <div className="mt-2 flex gap-2">
              <input readOnly value={newSecret.secret} onFocus={(e) => e.currentTarget.select()} aria-label="Signing secret" className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 font-mono text-xs" />
              <button type="button" onClick={() => navigator.clipboard?.writeText(newSecret.secret)} className="flex items-center gap-1 rounded-md border border-amber-400 bg-white px-3 py-2 whitespace-nowrap hover:bg-amber-100">
                <FiCopy /> Copy
              </button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Your endpoints">
        {!endpoints && !error && <p className="text-gray-500">Loading…</p>}
        {endpoints?.length === 0 && <p className="text-gray-500">No webhooks yet. Add one above.</p>}
        <ul className="divide-y">
          {endpoints?.map((endpoint) => (
            <li key={endpoint.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm text-gray-800">{endpoint.url}</div>
                  <div className="text-xs text-gray-500">Added {formatDate(endpoint.createdAt)}</div>
                </div>
                <div className="flex gap-2 text-sm">
                  <button type="button" aria-expanded={openId === endpoint.id} onClick={() => setOpenId(openId === endpoint.id ? null : endpoint.id)} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
                    {openId === endpoint.id ? 'Hide deliveries' : 'Deliveries'}
                  </button>
                  <button type="button" onClick={() => remove(endpoint)} className="rounded-md border border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-50">Delete</button>
                </div>
              </div>
              {openId === endpoint.id && <Deliveries endpointId={endpoint.id} />}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

const STATUS = {
  pending: { label: 'Sending', className: 'bg-yellow-100 text-yellow-800' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
} as const;

function Deliveries({ endpointId }: { endpointId: string }) {
  const [deliveries, setDeliveries] = useState<WebhookDeliveryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => api.webhookDeliveries(endpointId).then(setDeliveries, () => setError('Could not load deliveries.')), [endpointId]);
  useEffect(() => void refresh(), [refresh]);

  // Watch pending deliveries until they settle.
  const anyPending = deliveries?.some((d) => d.status === 'pending') ?? false;
  useEffect(() => {
    if (!anyPending) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [anyPending, refresh]);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Recent deliveries</span>
        <button type="button" onClick={() => act(() => api.testWebhook(endpointId))} className="text-brand hover:underline">Send a test event</button>
      </div>
      {error && <p className="mb-2 text-red-700">{error}</p>}
      {deliveries?.length === 0 && <p className="text-gray-500">Nothing sent yet. Send a test event to try it.</p>}
      {deliveries && deliveries.length > 0 && (
        <ul className="divide-y">
          {deliveries.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[d.status].className}`}>
                {d.status === 'pending' && d.attempts > 0 ? 'Retrying' : STATUS[d.status].label}
              </span>
              <code className="text-xs">{d.eventType}</code>
              <span className="text-xs text-gray-500">{formatDate(d.createdAt)}</span>
              <span className="text-xs text-gray-500">{d.attempts} {d.attempts === 1 ? 'attempt' : 'attempts'}</span>
              {d.lastStatus !== null && <span className="text-xs text-gray-500">HTTP {d.lastStatus}</span>}
              {d.lastError && d.status !== 'delivered' && <span className="min-w-0 truncate text-xs text-red-700" title={d.lastError}>{d.lastError}</span>}
              <button type="button" onClick={() => act(() => api.resendDelivery(d.id))} className="ml-auto text-xs text-brand hover:underline">Resend</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
