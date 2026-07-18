'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Ellipsis,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  UserRound,
  X,
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

type TechnicianAlert = {
  id: string;
  subject: string;
  body: string;
  severity: string;
  requires_ack: boolean;
  acknowledged_at: string | null;
  read_at: string | null;
  sender: { id: string; name: string };
  service_order: { id: string; order_number: string } | null;
  visit: { id: string } | null;
  metadata: {
    event?: string;
    previous?: { planned_start_at?: string | null };
    current?: { planned_start_at?: string | null };
  } | null;
};

function playOperationalSignal(message: TechnicianAlert) {
  navigator.vibrate?.([180, 100, 180]);
  try {
    const context = new AudioContext();
    void context.resume().then(() => {
      [0, 0.28, 0.56].forEach((offset) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 820;
        gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(
          0.18,
          context.currentTime + offset + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          context.currentTime + offset + 0.18,
        );
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(context.currentTime + offset);
        oscillator.stop(context.currentTime + offset + 0.2);
      });
      window.setTimeout(() => void context.close(), 1000);
    });
  } catch {
    // Mobile browsers can block sound until the first interaction.
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(message.subject, { body: message.body });
  }
}

export function TechnicianShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState({
    id: '',
    name: 'Techniker',
    email: '',
  });
  const [unread, setUnread] = useState(0);
  const [criticalAlert, setCriticalAlert] = useState<TechnicianAlert | null>(
    null,
  );
  const notified = useRef(new Set<string>());

  useEffect(() => {
    apiRequest<{
      user: { id: string; name: string; email: string };
    }>('/auth/me')
      .then((result) => {
        setProfile(result.user);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function pollMessages() {
      try {
        const result = await apiRequest<{
          data: TechnicianAlert[];
          meta: { unread: number };
        }>('/technician/messages?unread=1&limit=50');
        if (!mounted) return;
        setUnread(result.meta.unread);
        const critical = result.data.find(
          (message) =>
            message.requires_ack &&
            !message.acknowledged_at &&
            message.sender.id !== profile.id,
        );
        if (critical) {
          setCriticalAlert(critical);
          if (!notified.current.has(critical.id)) {
            notified.current.add(critical.id);
            playOperationalSignal(critical);
          }
        }
      } catch {
        // Keep the field interface usable while connectivity is interrupted.
      }
    }
    void pollMessages();
    const timer = window.setInterval(pollMessages, 2500);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [profile.id]);

  async function acknowledgeAlert(open = false) {
    if (!criticalAlert) return;
    const alert = criticalAlert;
    await apiRequest(`/technician/messages/${alert.id}/acknowledge`, {
      method: 'POST',
    }).catch(() => null);
    setCriticalAlert(null);
    setUnread((current) => Math.max(0, current - 1));
    if (open) {
      router.push(
        alert.visit?.id
          ? `/technician/visits/${alert.visit.id}`
          : '/technician/messages',
      );
    }
  }

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
            {unread > 0 && (
              <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs">
                {unread}
              </span>
            )}
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
              {profile.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{profile.name}</div>
              <div className="max-w-32 truncate text-xs text-white/60">
                {profile.email} · Online
              </div>
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
            <Link href="/technician/messages" className="relative">
              <Bell className="size-6" />
              {unread > 0 && (
                <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-[#ff5a0a] text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
            <Link href="/technician/more" className="lg:hidden">
              <Menu className="size-7" />
            </Link>
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

      {criticalAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061b31]/70 p-4 backdrop-blur-sm">
          <section className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between bg-[#ff5a0a] p-5 text-white">
              <div>
                <div className="text-xs font-bold tracking-wider uppercase opacity-80">
                  Wichtige Änderung
                </div>
                <h2 className="mt-1 text-xl font-bold">
                  {criticalAlert.subject}
                </h2>
              </div>
              <button
                onClick={() => setCriticalAlert(null)}
                className="rounded-lg p-1 hover:bg-white/15"
              >
                <X className="size-5" />
              </button>
            </header>
            <div className="p-5">
              {criticalAlert.service_order && (
                <div className="mb-3 text-sm font-semibold text-[#ff5a0a]">
                  {criticalAlert.service_order.order_number}
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {criticalAlert.body}
              </p>
              {criticalAlert.metadata?.previous?.planned_start_at &&
                criticalAlert.metadata?.current?.planned_start_at && (
                  <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Bisher</div>
                      <div className="mt-1 font-semibold">
                        {new Date(
                          criticalAlert.metadata.previous.planned_start_at,
                        ).toLocaleString('de-DE')}
                      </div>
                    </div>
                    <span className="text-slate-400">→</span>
                    <div>
                      <div className="text-xs text-slate-500">Neu</div>
                      <div className="mt-1 font-semibold text-[#ff5a0a]">
                        {new Date(
                          criticalAlert.metadata.current.planned_start_at,
                        ).toLocaleString('de-DE')}
                      </div>
                    </div>
                  </div>
                )}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => void acknowledgeAlert(false)}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border font-semibold"
                >
                  <CheckCircle2 className="size-5" /> Übernommen
                </button>
                <button
                  onClick={() => void acknowledgeAlert(true)}
                  className="h-12 rounded-xl bg-[#ff5a0a] font-semibold text-white"
                >
                  Änderung öffnen
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
