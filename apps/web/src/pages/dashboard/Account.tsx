import { UPLOAD_LIMITS } from '@vidcraft/shared';
import { useAuth } from '../../auth/AuthContext.tsx';
import { formatBytes, formatDate } from '../../lib/format.ts';
import { Panel } from './DashboardLayout.tsx';

export function Account() {
  const { user } = useAuth();
  if (!user) return null;

  const rows = [
    ['Name', `${user.firstName} ${user.lastName}`],
    ['Email', user.email],
    ['Member since', formatDate(user.createdAt)],
    ['Plan', `Free · up to ${formatBytes(UPLOAD_LIMITS.user)} per video`],
  ];
  return (
    <Panel title="Account">
      <dl className="divide-y">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 py-3 sm:flex-row">
            <dt className="font-medium sm:w-48">{label}</dt>
            <dd className="text-gray-600">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
