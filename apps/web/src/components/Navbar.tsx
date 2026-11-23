import { useEffect, useRef, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.tsx';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'text-brand' : 'text-gray-600 hover:text-brand';

export function Navbar() {
  const { user, loading, openModal } = useAuth();

  return (
    <nav className="relative z-30 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="text-xl font-bold text-gray-800">
          VidCraft
        </Link>
        <div className="hidden items-center gap-8 sm:flex">
          <NavLink to="/" end className={linkClass}>
            Tools
          </NavLink>
          <NavLink to="/pricing" className={linkClass}>
            Pricing
          </NavLink>
        </div>
        <div className="flex min-w-32 items-center justify-end gap-4">
          {loading ? null : user ? (
            <UserMenu />
          ) : (
            <>
              <button type="button" onClick={() => openModal('signin')} className="text-gray-600 hover:text-brand">
                Login
              </button>
              <button
                type="button"
                onClick={() => openModal('signup')}
                className="rounded-md border-2 border-brand px-4 py-2 text-brand hover:bg-brand hover:text-white"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking anywhere outside the menu.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current?.contains(e.target as Node) || setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;
  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2" aria-expanded={open}>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand font-medium text-white">
          {user.firstName[0]?.toUpperCase()}
          {user.lastName[0]?.toUpperCase()}
        </span>
        <FiChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <li className="truncate border-b border-gray-100 px-4 py-2 text-xs text-gray-500">{user.email}</li>
          <li>
            <button type="button" className="w-full px-4 py-2 text-left hover:bg-blue-50" onClick={() => go('/dashboard/history')}>
              My jobs
            </button>
          </li>
          <li>
            <button type="button" className="w-full px-4 py-2 text-left hover:bg-blue-50" onClick={() => go('/dashboard/account')}>
              Account
            </button>
          </li>
          <li>
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-red-700 hover:bg-red-50"
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate('/');
              }}
            >
              Logout
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
