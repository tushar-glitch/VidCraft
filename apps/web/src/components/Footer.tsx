import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-zinc-50">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 p-6 sm:flex-row">
        <span className="text-sm text-gray-600">© {new Date().getFullYear()} VidCraft. All rights reserved.</span>
        <div className="flex gap-8 text-gray-600">
          <Link to="/" className="hover:text-brand">
            Tools
          </Link>
          <Link to="/pricing" className="hover:text-brand">
            Pricing
          </Link>
        </div>
      </div>
    </footer>
  );
}
