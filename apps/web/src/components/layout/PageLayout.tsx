'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/documents', label: 'DocuMind' },
];

interface Props {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumb?: string;
}

export function PageLayout({ children, title, subtitle, action, breadcrumb }: Props) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f4f8' }}>

      <header className="sticky top-0 z-40" style={{ background: '#0f1a2e' }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 sm:h-14 sm:py-0 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">

          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                 style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
              &#9711;
            </div>
            <span className="font-bold text-white text-sm tracking-tight truncate">
              RamVector
            </span>
          </Link>

          <nav className="order-3 sm:order-2 w-full sm:w-auto flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {NAV.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive ? 'text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                  style={isActive ? { background: '#2563eb' } : {}}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="order-2 sm:order-3 flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/50">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                 style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
              RV
            </div>
          </div>
        </div>
      </header>

      {title && (
        <div className="bg-white border-b border-slate-100 shadow-xs">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div>
              {breadcrumb && (
                <p className="text-xs text-slate-400 mb-0.5 font-semibold uppercase tracking-wider">
                  {breadcrumb}
                </p>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {title}
              </h1>
              {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 sm:h-11 sm:py-0 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-1">
          <span className="text-xs text-slate-400">&copy; 2026 RamVector. All rights reserved.</span>
          <span className="text-xs text-slate-400">Intelligent Document Platform</span>
        </div>
      </footer>
    </div>
  );
}
