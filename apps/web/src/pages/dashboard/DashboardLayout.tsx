import { FiClipboard, FiFilm, FiUser } from 'react-icons/fi';
import { Navigate, NavLink, Outlet } from 'react-router';
import { useAuth } from '../../auth/AuthContext.tsx';

const LINKS = [
  { to: '/dashboard/videos', label: 'Videos', icon: FiFilm },
  { to: '/dashboard/history', label: 'Tool history', icon: FiClipboard },
  { to: '/dashboard/account', label: 'Account', icon: FiUser },
];

/** Sidebar + page. Signed-out visitors are sent to the home page. */
export function DashboardLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-gray-100 md:flex-row">
      <aside className="border-b border-gray-200 bg-white p-4 md:w-60 md:border-r md:border-b-0">
        <nav className="flex gap-2 md:flex-col">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-brand' : 'text-gray-800 hover:text-brand'}`
              }
            >
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-5xl rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
