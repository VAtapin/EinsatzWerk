'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
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
  message_id?: string;
  type: string;
  severity?: string;
  title: string;
  body: string;
  href: string;
  created_at: string;
};

type TelephonyCustomer = {
  id: string;
  customer_number: string;
  display_name: string;
  primary_phone: string | null;
  secondary_phone: string | null;
  notes: string | null;
  service_locations: Array<{
    id: string;
    street: string | null;
    house_number: string | null;
    postal_code: string | null;
    city: string | null;
    is_primary: boolean;
  }>;
  assets: Array<{
    id: string;
    model: string | null;
    serial_number: string | null;
    manufacturer?: { name: string } | null;
  }>;
  open_orders: Array<{
    id: string;
    order_number: string;
    status: string;
    fault_description: string;
  }>;
};

type TelephonyCall = {
  id: string;
  provider: string;
  direction: string;
  status: 'ringing' | 'accepted' | 'ended' | 'missed';
  from_number: string | null;
  to_number: string | null;
  caller_name: string | null;
  extension: string | null;
  acknowledged_at: string | null;
  customer: TelephonyCustomer | null;
  matches: TelephonyCustomer[];
  created_at: string;
  updated_at: string;
};

function signalIncomingCall(call: TelephonyCall) {
  document.title = `${call.from_number ?? 'Anruf'} · EinsatzWerk`;
  window.setTimeout(() => {
    document.title = 'EinsatzWerk';
  }, 8000);

  try {
    const audioContext = new AudioContext();
    void audioContext.resume().then(() => {
      [0, 0.32].forEach((offset, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = index === 0 ? 740 : 880;
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(
          0.16,
          audioContext.currentTime + offset + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          audioContext.currentTime + offset + 0.24,
        );
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime + offset);
        oscillator.stop(audioContext.currentTime + offset + 0.25);
      });
      window.setTimeout(() => void audioContext.close(), 900);
    });
  } catch {
    // Some browsers block sound before the first user interaction.
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Eingehender Anruf', {
      body:
        call.customer?.display_name ||
        call.caller_name ||
        call.from_number ||
        'Unbekannter Anrufer',
    });
  }
}

function signalOperationalNotification(notification: OfficeNotification) {
  try {
    const context = new AudioContext();
    void context.resume().then(() => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 700;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.14, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.35,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.36);
      window.setTimeout(() => void context.close(), 600);
    });
  } catch {
    // Browsers can block sound before the first interaction.
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(notification.title, { body: notification.body });
  }
}

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
  const [incomingCall, setIncomingCall] = useState<TelephonyCall | null>(null);
  const telephonyCursor = useRef<string | null>(null);
  const notifiedCalls = useRef(new Set<string>());
  const knownNotificationIds = useRef(new Set<string>());
  const notificationsInitialized = useRef(false);

  useEffect(() => {
    apiRequest<{ user: CurrentUser }>('/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => router.replace('/login'));
  }, [router, pathname]);

  useEffect(() => {
    let mounted = true;
    async function pollNotifications() {
      try {
        const result = await apiRequest<{
          data: OfficeNotification[];
          meta: { count: number };
        }>('/office/notifications');
        if (!mounted) return;
        if (notificationsInitialized.current) {
          const newImportant = result.data.find(
            (item) =>
              item.type === 'message' &&
              ['high', 'urgent'].includes(item.severity ?? '') &&
              !knownNotificationIds.current.has(item.id),
          );
          if (newImportant) signalOperationalNotification(newImportant);
        }
        result.data.forEach((item) =>
          knownNotificationIds.current.add(item.id),
        );
        notificationsInitialized.current = true;
        setNotifications(result.data);
      } catch {
        // Header notifications recover on the next polling cycle.
      }
    }
    void pollNotifications();
    const timer = window.setInterval(pollNotifications, 3000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

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

  useEffect(() => {
    let mounted = true;
    let initialRequest = true;

    async function pollTelephonyCalls() {
      const query = initialRequest
        ? '?active=1&limit=10'
        : telephonyCursor.current
          ? `?after=${encodeURIComponent(telephonyCursor.current)}&limit=20`
          : '?limit=20';
      initialRequest = false;

      try {
        const result = await apiRequest<{
          data: TelephonyCall[];
          meta: { server_time: string };
        }>(`/telephony/calls${query}`);

        if (!mounted) return;
        telephonyCursor.current = result.meta.server_time;
        const newIncomingCall = result.data.find(
          (call) =>
            call.direction === 'incoming' &&
            !call.acknowledged_at &&
            ['ringing', 'accepted', 'missed'].includes(call.status),
        );
        if (newIncomingCall && !notifiedCalls.current.has(newIncomingCall.id)) {
          notifiedCalls.current.add(newIncomingCall.id);
          signalIncomingCall(newIncomingCall);
        }
        setIncomingCall((current) => {
          const updatedCurrent = current
            ? result.data.find((call) => call.id === current.id)
            : null;

          if (updatedCurrent?.acknowledged_at) return null;
          if (updatedCurrent?.status === 'ended') return null;
          if (updatedCurrent) return updatedCurrent;

          return newIncomingCall ?? current ?? null;
        });
      } catch {
        // Telephony is optional. The office remains usable while it is unavailable.
      }
    }

    void pollTelephonyCalls();
    const timer = window.setInterval(pollTelephonyCalls, 2000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

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

  async function openNotification(notification: OfficeNotification) {
    if (notification.message_id) {
      await apiRequest(`/messages/${notification.message_id}/read`, {
        method: 'PATCH',
      }).catch(() => null);
      setNotifications((current) =>
        current.filter((item) => item.id !== notification.id),
      );
    }
    navigate(notification.href);
  }

  async function acknowledgeCall(call: TelephonyCall) {
    await apiRequest(`/telephony/calls/${call.id}/acknowledge`, {
      method: 'POST',
    }).catch(() => null);
    setIncomingCall(null);
  }

  async function openIncomingCall(
    call: TelephonyCall,
    customer: TelephonyCustomer | null = call.customer,
  ) {
    await apiRequest(`/telephony/calls/${call.id}/acknowledge`, {
      method: 'POST',
    }).catch(() => null);

    const parameters = new URLSearchParams({
      source: 'telephony',
      call: call.id,
    });
    if (call.from_number) parameters.set('phone', call.from_number);
    if (customer) parameters.set('customer', customer.id);
    else parameters.set('new', '1');

    setIncomingCall(null);
    router.push(`/office/call-intake?${parameters.toString()}`);
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
                <div className="font-semibold">
                  {user?.name ?? 'Wird geladen…'}
                </div>
                <div className="text-xs text-white/65">
                  {user?.role === 'office_admin'
                    ? 'Office Admin'
                    : 'Disposition'}
                </div>
              </div>
              <ChevronDown className="size-4 text-white/70" />
            </button>
          </div>
        </header>

        <main>{children}</main>
      </div>

      {incomingCall && (
        <section
          role="dialog"
          aria-label="Eingehender Anruf"
          className="fixed top-[86px] right-6 z-[65] w-[430px] overflow-hidden rounded-2xl border border-orange-200 bg-white text-[#10213d] shadow-2xl"
        >
          <div className="flex items-start justify-between bg-[#ff5a0a] px-5 py-4 text-white">
            <div className="flex gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Phone className="size-6" />
              </div>
              <div>
                <div className="text-xs font-bold tracking-wider uppercase opacity-80">
                  {incomingCall.status === 'missed'
                    ? 'Verpasster Anruf'
                    : 'Eingehender Anruf'}
                </div>
                <div className="mt-1 text-xl font-bold">
                  {incomingCall.caller_name ||
                    incomingCall.customer?.display_name ||
                    incomingCall.from_number ||
                    'Unbekannter Anrufer'}
                </div>
                {incomingCall.from_number && (
                  <div className="mt-0.5 text-sm opacity-90">
                    {incomingCall.from_number}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => void acknowledgeCall(incomingCall)}
              title="Schließen"
              className="rounded-lg p-1.5 hover:bg-white/15"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="p-5">
            {incomingCall.customer && (
              <>
                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-bold">
                        {incomingCall.customer.display_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {incomingCall.customer.customer_number}
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Kunde erkannt
                    </span>
                  </div>
                  {incomingCall.customer.service_locations[0] && (
                    <div className="mt-3 text-sm text-slate-600">
                      {[
                        incomingCall.customer.service_locations[0].street,
                        incomingCall.customer.service_locations[0].house_number,
                        incomingCall.customer.service_locations[0].postal_code,
                        incomingCall.customer.service_locations[0].city,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-white p-3">
                      <div className="text-xs text-slate-500">Geräte</div>
                      <div className="mt-1 font-bold">
                        {incomingCall.customer.assets.length}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <div className="text-xs text-slate-500">
                        Offene Aufträge
                      </div>
                      <div className="mt-1 font-bold">
                        {incomingCall.customer.open_orders.length}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => void openIncomingCall(incomingCall)}
                  className="mt-4 h-12 w-full rounded-xl bg-[#ff5a0a] font-bold text-white hover:bg-[#e84e00]"
                >
                  Kundendaten in Anrufannahme öffnen
                </button>
              </>
            )}

            {!incomingCall.customer && incomingCall.matches.length > 1 && (
              <>
                <div className="mb-3 text-sm font-semibold">
                  Mehrere Kunden passen zu dieser Nummer:
                </div>
                <div className="space-y-2">
                  {incomingCall.matches.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() =>
                        void openIncomingCall(incomingCall, customer)
                      }
                      className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:border-orange-300 hover:bg-orange-50"
                    >
                      <span>
                        <span className="block font-semibold">
                          {customer.display_name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {customer.customer_number}
                        </span>
                      </span>
                      <ChevronDown className="-rotate-90 size-4" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {!incomingCall.customer && incomingCall.matches.length <= 1 && (
              <>
                <div className="rounded-xl border border-dashed p-5 text-center">
                  <div className="font-semibold">Nummer nicht zugeordnet</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Der Anruf kann direkt als neuer Kunde aufgenommen werden.
                  </div>
                </div>
                <button
                  onClick={() => void openIncomingCall(incomingCall, null)}
                  className="mt-4 h-12 w-full rounded-xl bg-[#ff5a0a] font-bold text-white hover:bg-[#e84e00]"
                >
                  In Anrufannahme übernehmen
                </button>
              </>
            )}
          </div>
        </section>
      )}

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
                onClick={() => void openNotification(notification)}
                className="w-full border-b px-5 py-4 text-left hover:bg-slate-50"
              >
                <div className="text-sm font-semibold">
                  {notification.title}
                </div>
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
