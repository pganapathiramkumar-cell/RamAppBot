'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/documents', label: 'DocuMind' },
  { href: '/skill',     label: 'Skill AI'  },
  { href: '/steer',     label: 'Steer AI'  },
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

      {/* ── Top nav (dark navy — matches DocuMind) ─────────── */}
      <header className="sticky top-0 z-40" style={{ background: '#0f1a2e' }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                 style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
              🤖
            </div>
            <span className="font-bold text-white text-sm tracking-tight">
              RamBot<span className="font-normal opacity-60">Enterprise AI</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 ${
                    isActive ? 'text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                  style={isActive ? { background: '#2563eb' } : {}}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/50">
              <span>Groq · Llama 3.3</span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                 style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
              R
            </div>
          </div>
        </div>
      </header>

      {/* ── Page header ─────────────────────────────────────── */}
      {title && (
        <div className="bg-white border-b border-slate-100 shadow-xs">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
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

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-screen-xl mx-auto px-6 h-11 flex items-center justify-between">
          <span className="text-xs text-slate-400">© 2025 RamBot Enterprise</span>
          <span className="text-xs text-slate-400">Powered by Groq · Llama 3.3</span>
        </div>
      </footer>
    </div>
  );
}
