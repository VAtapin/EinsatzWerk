'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  CalendarCheck,
  ClipboardList,
  Ellipsis,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  UserRound,
} from 'lucide-react';
import { apiRequest, clearAccessToken } from '@/lib/einsatzwerk-api';
import { EinsatzWerkBrand } from './brand';

const nav = [
  { href: '/technician/today', label: 'Übersicht', icon: CalendarCheck },
  { href: '/technician/orders', label: 'Aufträge', icon: ClipboardList },
  { href: '/technician/new', label: 'Neuer Einsatz', icon: Plus },
  { href: '/technician/customers', label: 'Kunden', icon: UserRound },
  { href: '/technician/more', label: 'Mehr', icon: Ellipsis },
];

export function TechnicianShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => null);
    clearAccessToken();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#10213d]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col bg-[#061b31] text-white lg:flex">
        <div className="flex h-24 items-center px-6">
          <EinsatzWerkBrand />
        </div>
        <nav className="flex-1 space-y-2 px-4 py-5">
          {nav.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-14 items-center gap-4 rounded-xl px-4 ${
                  active
                    ? 'bg-[#ff5a0a] font-semibold text-white'
                    : 'text-white/80 hover:bg-white/8'
                }`}
              >
                <Icon className="size-6" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/technician/messages"
            className="flex h-14 items-center gap-4 rounded-xl px-4 text-white/80 hover:bg-white/8"
          >
            <MessageSquare className="size-6" />
            Nachrichten
            <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs">
              3
            </span>
          </Link>
        </nav>
        <div className="border-t border-white/10 p-4">
          <Link
            href="/technician/settings"
            className="flex h-12 items-center gap-4 text-white/75"
          >
            <Settings className="size-6" />
            Einstellungen
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-orange-100 font-bold text-[#ff5a0a]">
              TB
            </div>
            <div>
              <div className="font-semibold">Thomas Becker</div>
              <div className="text-xs text-white/60">T-1001 · Online</div>
            </div>
            <button
              onClick={logout}
              className="ml-auto flex size-10 items-center justify-center rounded-full hover:bg-white/10"
              title="Abmelden"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b bg-white px-5 lg:px-8">
          <div className="lg:hidden">
            <EinsatzWerkBrand compact />
          </div>
          <h1 className="hidden text-2xl font-bold lg:block">Meine Einsätze</h1>
          <div className="flex items-center gap-5">
            <div className="relative">
              <Bell className="size-6" />
              <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-[#ff5a0a] text-[10px] font-bold text-white">
                3
              </span>
            </div>
            <Menu className="size-7 lg:hidden" />
          </div>
        </header>

        <main className="pb-24 lg:pb-0">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid h-20 grid-cols-5 border-t bg-white px-2 lg:hidden">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            const central = item.label === 'Neuer Einsatz';
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] ${
                  active ? 'text-[#ff5a0a]' : 'text-slate-500'
                }`}
              >
                <span
                  className={
                    central
                      ? 'flex size-14 -translate-y-3 items-center justify-center rounded-full bg-[#061b31] text-white shadow-xl'
                      : ''
                  }
                >
                  <Icon className={central ? 'size-8' : 'size-6'} />
                </span>
                {!central && item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
