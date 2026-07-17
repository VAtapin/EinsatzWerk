'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  FileText,
  LogOut,
  MapPinned,
  Menu,
  MessageSquare,
  PackageOpen,
  Phone,
  Search,
  Settings,
  Users,
  Wrench,
} from 'lucide-react';
import { apiRequest, clearAccessToken } from '@/lib/einsatzwerk-api';
import { EinsatzWerkBrand } from './brand';

const navigation = [
  {
    label: 'OFFICE',
    items: [
      { label: 'Anrufannahme', href: '/office/call-intake', icon: Phone },
      { label: 'Aufträge', href: '/office/orders', icon: ClipboardList },
      { label: 'Planung', href: '/office/planning', icon: CalendarDays },
      { label: 'Analytik', href: '/office/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'STAMMDATEN',
    items: [
      { label: 'Kunden', href: '/office/customers', icon: Users },
      { label: 'Geräte', href: '/office/assets', icon: PackageOpen },
      { label: 'Techniker', href: '/office/technicians', icon: Wrench },
      {
        label: 'Servicebereiche',
        href: '/office/service-areas',
        icon: MapPinned,
      },
      { label: 'Lager / Teile', href: '/office/inventory', icon: Boxes },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { label: 'Berichte', href: '/office/reports', icon: FileText },
      { label: 'Dokumente', href: '/office/documents', icon: FileText },
      { label: 'Nachrichten', href: '/office/messages', icon: MessageSquare },
      { label: 'Einstellungen', href: '/office/settings', icon: Settings },
    ],
  },
];

export function OfficeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => null);
    clearAccessToken();
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen w-full bg-[#f5f7fb] text-[#10213d]">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[220px] flex-col bg-[#061b31] text-white">
        <div className="flex h-[72px] items-center border-b border-white/10 px-5">
          <EinsatzWerkBrand />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {navigation.map((section) => (
            <div key={section.label} className="mb-4">
              <div className="px-3 pb-2 text-[10px] tracking-wide text-white/55">
                {section.label}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition ${
                        active
                          ? 'bg-gradient-to-r from-[#ff5a0a] to-[#ff6d0a] font-semibold text-white shadow-lg shadow-orange-950/20'
                          : 'text-white/85 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      <Icon className="size-5" strokeWidth={1.8} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              {section.label !== 'SYSTEM' && (
                <div className="mt-4 border-b border-white/12" />
              )}
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/10 p-3">
          <button
            onClick={logout}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-2 text-sm text-white/80 hover:bg-white/8"
          >
            <CircleHelp className="size-5" /> Hilfe & Support
          </button>
          <button className="flex h-10 w-full items-center gap-3 rounded-lg px-2 text-sm text-white/80 hover:bg-white/8">
            <LogOut className="size-5" /> Abmelden
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pl-[220px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between bg-[#061b31] px-7 text-white shadow-sm">
          <button className="lg:hidden">
            <Menu />
          </button>
          <button className="flex h-11 w-[490px] items-center gap-3 rounded-lg border border-white/15 bg-white px-4 text-left text-sm text-slate-500 shadow-sm">
            <Search className="size-5" />
            <span className="flex-1">
              Suche nach Kunde, Adresse, Telefonnummer, Gerät…
            </span>
            <kbd className="rounded border bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
              Ctrl + K
            </kbd>
          </button>

          <div className="flex items-center gap-5">
            <Phone className="size-5" />
            <div className="relative">
              <Bell className="size-5" />
              <span className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-[#ff5a0a] text-[9px] font-bold">
                3
              </span>
            </div>
            <CircleHelp className="size-5" />
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-orange-100 font-semibold text-[#ff5a0a]">
                SB
              </div>
              <div className="text-sm">
                <div className="font-semibold">Sabine Becker</div>
                <div className="text-xs text-white/65">Disposition</div>
              </div>
              <ChevronDown className="size-4 text-white/70" />
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
