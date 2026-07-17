'use client';

import { ReactNode, useEffect, useState } from 'react';
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
  X,
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

type CurrentUser = {
  name: string;
  email: string;
  role: string;
};

type SearchResult = {
  type: 'customer' | 'order' | 'asset';
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

type OfficeNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  created_at: string;
};

export function OfficeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notifications, setNotifications] = useState<OfficeNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    apiRequest<{ user: CurrentUser }>('/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => router.replace('/login'));
    apiRequest<{
      data: OfficeNotification[];
      meta: { count: number };
    }>('/office/notifications')
      .then((result) => setNotifications(result.data))
      .catch(() => setNotifications([]));
  }, [router, pathname]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
        setHelpOpen(false);
      }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);

  useEffect(() => {
    const normalized = searchQuery.trim();
    if (normalized.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      apiRequest<{ data: SearchResult[] }>(
        `/office/search?q=${encodeURIComponent(normalized)}`,
      )
        .then((result) => setSearchResults(result.data))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  async function logout() {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => null);
    clearAccessToken();
    router.replace('/login');
  }

  function navigate(href: string) {
    setSearchOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
    router.push(href);
  }

  const initials = (user?.name ?? 'EinsatzWerk')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
            onClick={() => setHelpOpen(true)}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-2 text-sm text-white/80 hover:bg-white/8"
          >
            <CircleHelp className="size-5" /> Hilfe & Support
          </button>
          <button
            onClick={logout}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-2 text-sm text-white/80 hover:bg-white/8"
          >
            <LogOut className="size-5" /> Abmelden
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pl-[220px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between bg-[#061b31] px-7 text-white shadow-sm">
          <button className="lg:hidden">
            <Menu />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-11 w-[490px] items-center gap-3 rounded-lg border border-white/15 bg-white px-4 text-left text-sm text-slate-500 shadow-sm"
          >
            <Search className="size-5" />
            <span className="flex-1">
              Suche nach Kunde, Adresse, Telefonnummer, Gerät…
            </span>
            <kbd className="rounded border bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
              Ctrl + K
            </kbd>
          </button>

          <div className="flex items-center gap-5">
            <Link
              href="/office/call-intake"
              title="Anrufannahme öffnen"
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <Phone className="size-5" />
            </Link>
            <button
              onClick={() => {
                setNotificationsOpen((current) => !current);
                setProfileOpen(false);
              }}
              title="Benachrichtigungen"
              className="relative rounded-lg p-2 hover:bg-white/10"
            >
              <Bell className="size-5" />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 flex size-4 items-center justify-center rounded-full bg-[#ff5a0a] text-[9px] font-bold">
                  {Math.min(notifications.length, 9)}
                </span>
              )}
            </button>
            <button
              onClick={() => setHelpOpen(true)}
              title="Hilfe"
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <CircleHelp className="size-5" />
            </button>
            <button
              onClick={() => {
                setProfileOpen((current) => !current);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-3 rounded-lg p-1 hover:bg-white/10"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-orange-100 font-semibold text-[#ff5a0a]">
                {initials}
              </div>
              <div className="text-sm">
                <div className="font-semibold">{user?.name ?? 'Wird geladen…'}</div>
                <div className="text-xs text-white/65">
                  {user?.role === 'office_admin' ? 'Office Admin' : 'Disposition'}
                </div>
              </div>
              <ChevronDown className="size-4 text-white/70" />
            </button>
          </div>
        </header>

        <main>{children}</main>
      </div>

      {notificationsOpen && (
        <div className="fixed top-[66px] right-6 z-50 w-[380px] overflow-hidden rounded-xl border bg-white text-[#10213d] shadow-2xl">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <div className="font-bold">Benachrichtigungen</div>
              <div className="text-xs text-slate-500">
                Offene Vorgänge aus Disposition und Lager
              </div>
            </div>
            <button onClick={() => setNotificationsOpen(false)}>
              <X className="size-5 text-slate-400" />
            </button>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => navigate(notification.href)}
                className="w-full border-b px-5 py-4 text-left hover:bg-slate-50"
              >
                <div className="text-sm font-semibold">{notification.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {notification.body}
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  {new Date(notification.created_at).toLocaleString('de-DE')}
                </div>
              </button>
            ))}
            {notifications.length === 0 && (
              <div className="p-10 text-center text-sm text-slate-500">
                Keine offenen Benachrichtigungen.
              </div>
            )}
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="fixed top-[66px] right-6 z-50 w-72 overflow-hidden rounded-xl border bg-white text-[#10213d] shadow-2xl">
          <div className="border-b p-5">
            <div className="font-bold">{user?.name}</div>
            <div className="mt-1 text-sm text-slate-500">{user?.email}</div>
          </div>
          <button
            onClick={() => {
              setProfileOpen(false);
              setHelpOpen(true);
            }}
            className="flex h-12 w-full items-center gap-3 px-5 text-sm hover:bg-slate-50"
          >
            <CircleHelp className="size-5" /> Hilfe & Support
          </button>
          <button
            onClick={logout}
            className="flex h-12 w-full items-center gap-3 border-t px-5 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="size-5" /> Abmelden
          </button>
        </div>
      )}

      {searchOpen && (
        <div
          className="fixed inset-0 z-[70] flex justify-center bg-[#061b31]/55 px-6 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSearchOpen(false);
          }}
        >
          <div className="h-fit w-full max-w-2xl overflow-hidden rounded-2xl bg-white text-[#10213d] shadow-2xl">
            <div className="flex items-center gap-3 border-b px-5">
              <Search className="size-5 text-slate-400" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-16 flex-1 outline-none"
                placeholder="Kunde, Telefon, Adresse, Auftrag oder Gerät suchen…"
              />
              <button onClick={() => setSearchOpen(false)}>
                <X className="size-5 text-slate-400" />
              </button>
            </div>
            <div className="max-h-[520px] overflow-y-auto p-2">
              {searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => navigate(result.href)}
                  className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold uppercase text-slate-500">
                    {result.type === 'customer'
                      ? 'KD'
                      : result.type === 'order'
                        ? 'AU'
                        : 'GR'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{result.title}</div>
                    <div className="truncate text-sm text-slate-500">
                      {result.subtitle}
                    </div>
                  </div>
                  <ChevronDown className="-rotate-90 size-4 text-slate-400" />
                </button>
              ))}
              {searching && (
                <div className="p-8 text-center text-sm text-slate-500">
                  Suche läuft…
                </div>
              )}
              {!searching &&
                searchQuery.trim().length >= 2 &&
                searchResults.length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Keine passenden Ergebnisse.
                  </div>
                )}
              {searchQuery.trim().length < 2 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  Mindestens zwei Zeichen eingeben.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#061b31]/55 p-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-[#10213d] shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">Hilfe & Support</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Unterstützung direkt aus dem Arbeitsplatz
                </p>
              </div>
              <button onClick={() => setHelpOpen(false)}>
                <X className="size-5 text-slate-400" />
              </button>
            </div>
            <div className="mt-6 space-y-3">
              <Link
                href="/office/call-intake"
                onClick={() => setHelpOpen(false)}
                className="flex items-center gap-3 rounded-xl border p-4 hover:bg-slate-50"
              >
                <Phone className="size-5 text-[#ff5a0a]" />
                <div>
                  <div className="font-semibold">Anrufannahme öffnen</div>
                  <div className="text-sm text-slate-500">
                    Kunde suchen und neuen Auftrag erfassen
                  </div>
                </div>
              </Link>
              <a
                href="mailto:support@einsatz-werk.de"
                className="flex items-center gap-3 rounded-xl border p-4 hover:bg-slate-50"
              >
                <MessageSquare className="size-5 text-[#ff5a0a]" />
                <div>
                  <div className="font-semibold">Support kontaktieren</div>
                  <div className="text-sm text-slate-500">
                    support@einsatz-werk.de
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
