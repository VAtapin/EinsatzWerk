'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronRight,
  FileText,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  UserRound,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, getAccessToken } from '@/lib/einsatzwerk-api';

type VisitItem = {
  id: string;
  status: string;
  planned_start_at: string;
  planned_end_at: string;
  order: {
    id: string;
    order_number: string;
    priority: string;
    fault_description: string;
  };
  customer: {
    id: string;
    name: string;
    primary_phone: string | null;
  };
  location: {
    street: string | null;
    house_number: string | null;
    postal_code: string | null;
    city: string | null;
  };
  asset: {
    id: string;
    model: string | null;
    serial_number: string | null;
  } | null;
};

type TechnicianCustomer = {
  id: string;
  customer_number: string;
  first_name: string | null;
  last_name: string;
  company_name: string | null;
  primary_phone: string | null;
  email: string | null;
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
    status: string;
  }>;
};

function useTechnicianAccess() {
  const router = useRouter();
  useEffect(() => {
    if (!getAccessToken()) router.replace('/login');
  }, [router]);
  return router;
}

function address(location: VisitItem['location'] | TechnicianCustomer['service_locations'][number]) {
  return [
    location.street,
    location.house_number,
    location.postal_code,
    location.city,
  ]
    .filter(Boolean)
    .join(' ');
}

const statusNames: Record<string, string> = {
  planned: 'Geplant',
  en_route: 'Unterwegs',
  arrived: 'Angekommen',
  in_progress: 'In Arbeit',
  awaiting_parts: 'Warten auf Teile',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

export function TechnicianOrdersPage() {
  useTechnicianAccess();
  const [items, setItems] = useState<VisitItem[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    apiRequest<{ data: VisitItem[] }>(
      `/technician/visits${status ? `?status=${status}` : ''}`,
    )
      .then((result) => setItems(result.data))
      .catch(() => toast.error('Aufträge konnten nicht geladen werden.'));
  }, [status]);
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Meine Aufträge</h1>
        <p className="mt-1 text-sm text-slate-500">
          Alle zugewiesenen Einsätze
        </p>
      </div>
      <div className="mb-4 flex gap-3 overflow-x-auto border-b">
        {[
          ['', 'Alle'],
          ['planned', 'Geplant'],
          ['in_progress', 'In Arbeit'],
          ['awaiting_parts', 'Teile'],
          ['completed', 'Abgeschlossen'],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={`shrink-0 border-b-2 px-1 pb-3 text-sm ${
              status === value
                ? 'border-[#ff5a0a] font-semibold text-[#ff5a0a]'
                : 'border-transparent text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {items.map((visit) => (
          <Link
            key={visit.id}
            href={`/technician/visits/${visit.id}`}
            className="grid gap-4 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-[120px_1fr_1fr_140px] md:items-center"
          >
            <div>
              <div className="text-lg font-bold text-[#ff5a0a]">
                {new Date(visit.planned_start_at).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div className="text-xs text-slate-500">{visit.order.order_number}</div>
            </div>
            <div>
              <div className="font-bold">{visit.customer.name}</div>
              <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <MapPin className="size-4" /> {address(visit.location)}
              </div>
            </div>
            <div>
              <div className="font-medium">{visit.asset?.model || 'Ohne Gerät'}</div>
              <div className="mt-1 line-clamp-2 text-sm text-slate-500">
                {visit.order.fault_description}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
                {statusNames[visit.status] ?? visit.status}
              </span>
              <ChevronRight className="size-5 text-slate-400" />
            </div>
          </Link>
        ))}
        {!items.length && (
          <div className="rounded-xl border bg-white p-12 text-center text-slate-500">
            Keine Einsätze in dieser Auswahl.
          </div>
        )}
      </div>
    </div>
  );
}

export function TechnicianCustomersPage() {
  useTechnicianAccess();
  const [items, setItems] = useState<TechnicianCustomer[]>([]);
  const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    const result = await apiRequest<{ data: TechnicianCustomer[] }>(
      `/technician/customers${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`,
    );
    setItems(result.data);
  }, [query]);
  useEffect(() => {
    const timer = window.setTimeout(
      () => load().catch(() => toast.error('Kunden konnten nicht geladen werden.')),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [load]);
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="text-2xl font-bold">Kunden</h1>
      <p className="mt-1 text-sm text-slate-500">
        Kunden aus meinen zugewiesenen Einsätzen
      </p>
      <div className="relative mt-5">
        <Search className="absolute top-3.5 left-3 size-4 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 w-full rounded-xl border bg-white pr-3 pl-10"
          placeholder="Name oder Telefonnummer…"
        />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((customer) => {
          const location =
            customer.service_locations.find((item) => item.is_primary) ??
            customer.service_locations[0];
          return (
            <section key={customer.id} className="rounded-xl border bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">
                    {customer.company_name ||
                      [customer.first_name, customer.last_name]
                        .filter(Boolean)
                        .join(' ')}
                  </h2>
                  <div className="text-xs text-slate-500">
                    {customer.customer_number}
                  </div>
                </div>
                <UserRound className="size-6 text-[#ff5a0a]" />
              </div>
              {location && (
                <div className="mt-4 flex gap-2 text-sm text-slate-600">
                  <MapPin className="mt-0.5 size-4" /> {address(location)}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                {customer.primary_phone && (
                  <a
                    href={`tel:${customer.primary_phone}`}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border"
                  >
                    <Phone className="size-4" /> Anrufen
                  </a>
                )}
                <Link
                  href={`/technician/new?customer=${customer.id}`}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5a0a] text-sm font-semibold text-white"
                >
                  <Plus className="size-4" /> Einsatz
                </Link>
              </div>
              <div className="mt-4 border-t pt-3 text-xs text-slate-500">
                {customer.assets.length} Geräte
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function TechnicianNewVisitPage() {
  const router = useTechnicianAccess();
  const [customers, setCustomers] = useState<TechnicianCustomer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [category, setCategory] = useState('Sonstiges');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [saving, setSaving] = useState(false);
  const selected = useMemo(
    () => customers.find((customer) => customer.id === customerId),
    [customerId, customers],
  );
  useEffect(() => {
    apiRequest<{ data: TechnicianCustomer[] }>('/technician/customers')
      .then((result) => {
        setCustomers(result.data);
        const requested = new URLSearchParams(window.location.search).get('customer');
        setCustomerId(
          result.data.some((customer) => customer.id === requested)
            ? (requested as string)
            : (result.data[0]?.id ?? ''),
        );
      })
      .catch(() => toast.error('Kunden konnten nicht geladen werden.'));
  }, []);
  useEffect(() => {
    setLocationId(
      selected?.service_locations.find((location) => location.is_primary)?.id ??
        selected?.service_locations[0]?.id ??
        '',
    );
    setAssetId(selected?.assets[0]?.id ?? '');
  }, [selected]);
  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiRequest<{ data: VisitItem }>(
        '/technician/emergency-visits',
        {
          method: 'POST',
          body: JSON.stringify({
            customer_id: customerId,
            service_location_id: locationId,
            asset_id: assetId || null,
            fault_category: category,
            fault_description: description,
            priority,
          }),
        },
      );
      toast.success('Einsatz wurde angelegt.');
      router.push(`/technician/visits/${result.data.id}`);
    } catch {
      toast.error('Einsatz konnte nicht angelegt werden.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <h1 className="text-2xl font-bold">Neuer Einsatz</h1>
      <p className="mt-1 text-sm text-slate-500">
        Ungeplanten Einsatz beim Kunden erfassen
      </p>
      <form onSubmit={create} className="mt-5 rounded-xl border bg-white">
        <div className="space-y-5 p-5">
          <label className="block text-sm font-medium">
            Kunde
            <select
              required
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="mt-1 h-12 w-full rounded-lg border bg-white px-3"
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.company_name ||
                    [customer.first_name, customer.last_name].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Serviceadresse
            <select
              required
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              className="mt-1 h-12 w-full rounded-lg border bg-white px-3"
            >
              {selected?.service_locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {address(location)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Gerät
            <select
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
              className="mt-1 h-12 w-full rounded-lg border bg-white px-3"
            >
              <option value="">Ohne Gerät</option>
              {selected?.assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.model || 'Gerät'} · {asset.serial_number || 'ohne SN'}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Kategorie
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-1 h-12 w-full rounded-lg border bg-white px-3"
              >
                {[
                  'Heizung / Warmwasser',
                  'Waschmaschine',
                  'Geschirrspüler',
                  'Kühlgerät',
                  'Wartung',
                  'Sonstiges',
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Priorität
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="mt-1 h-12 w-full rounded-lg border bg-white px-3"
              >
                <option value="low">Niedrig</option>
                <option value="normal">Mittel</option>
                <option value="high">Hoch</option>
                <option value="urgent">Dringend</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium">
            Beschreibung
            <textarea
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 min-h-36 w-full rounded-lg border p-3"
            />
          </label>
        </div>
        <footer className="border-t p-5">
          <button
            disabled={saving || !locationId}
            className="h-12 w-full rounded-lg bg-[#ff5a0a] font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Wird angelegt…' : 'Einsatz anlegen'}
          </button>
        </footer>
      </form>
    </div>
  );
}

type TechnicianMessage = {
  id: string;
  subject: string;
  body: string;
  created_at: string;
  sender: { name: string };
  recipient: { name: string } | null;
};

export function TechnicianMessagesPage() {
  useTechnicianAccess();
  const [items, setItems] = useState<TechnicianMessage[]>([]);
  const [form, setForm] = useState({ subject: '', body: '' });
  const load = useCallback(async () => {
    const result =
      await apiRequest<{ data: TechnicianMessage[] }>('/technician/messages');
    setItems(result.data);
  }, []);
  useEffect(() => {
    load().catch(() => toast.error('Nachrichten konnten nicht geladen werden.'));
  }, [load]);
  async function send(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest('/technician/messages', {
        method: 'POST',
        body: JSON.stringify({ ...form, recipient_id: null }),
      });
      setForm({ subject: '', body: '' });
      await load();
      toast.success('Nachricht wurde gesendet.');
    } catch {
      toast.error('Nachricht konnte nicht gesendet werden.');
    }
  }
  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 md:grid-cols-[1fr_380px] md:p-6">
      <section className="rounded-xl border bg-white">
        <header className="border-b p-5">
          <h1 className="text-xl font-bold">Nachrichten</h1>
        </header>
        <div className="divide-y">
          {items.map((message) => (
            <article key={message.id} className="p-5">
              <div className="flex justify-between">
                <strong>{message.subject}</strong>
                <span className="text-xs text-slate-500">
                  {new Date(message.created_at).toLocaleString('de-DE')}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {message.sender.name}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{message.body}</p>
            </article>
          ))}
          {!items.length && (
            <div className="p-12 text-center text-sm text-slate-500">
              Noch keine Nachrichten.
            </div>
          )}
        </div>
      </section>
      <form onSubmit={send} className="h-fit rounded-xl border bg-white">
        <header className="border-b p-5 font-bold">Nachricht an Disposition</header>
        <div className="space-y-4 p-5">
          <input
            required
            value={form.subject}
            onChange={(event) =>
              setForm((current) => ({ ...current, subject: event.target.value }))
            }
            className="h-11 w-full rounded-lg border px-3"
            placeholder="Betreff"
          />
          <textarea
            required
            value={form.body}
            onChange={(event) =>
              setForm((current) => ({ ...current, body: event.target.value }))
            }
            className="min-h-36 w-full rounded-lg border p-3"
            placeholder="Nachricht…"
          />
          <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#ff5a0a] font-semibold text-white">
            <Send className="size-4" /> Senden
          </button>
        </div>
      </form>
    </div>
  );
}

type Profile = {
  name: string;
  email: string;
  phone: string | null;
  locale: string;
};

export function TechnicianSettingsPage() {
  useTechnicianAccess();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    locale: 'de',
    password: '',
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    apiRequest<{ user: Profile }>('/auth/me')
      .then((result) =>
        setForm({
          name: result.user.name,
          email: result.user.email,
          phone: result.user.phone || '',
          locale: result.user.locale || 'de',
          password: '',
        }),
      )
      .catch(() => toast.error('Profil konnte nicht geladen werden.'));
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/technician/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          locale: form.locale,
          password: form.password || null,
        }),
      });
      setForm((current) => ({ ...current, password: '' }));
      toast.success('Profil wurde gespeichert.');
    } catch {
      toast.error('Profil konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <h1 className="text-2xl font-bold">Einstellungen</h1>
      <form onSubmit={save} className="mt-5 rounded-xl border bg-white">
        <header className="flex items-center gap-2 border-b p-5 font-bold">
          <Settings className="size-5 text-[#ff5a0a]" /> Mein Profil
        </header>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <label className="text-sm font-medium">
            Name
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              className="mt-1 h-11 w-full rounded-lg border px-3"
            />
          </label>
          <label className="text-sm font-medium">
            E-Mail
            <input
              disabled
              value={form.email}
              className="mt-1 h-11 w-full rounded-lg border bg-slate-50 px-3"
            />
          </label>
          <label className="text-sm font-medium">
            Telefon
            <input
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              className="mt-1 h-11 w-full rounded-lg border px-3"
            />
          </label>
          <label className="text-sm font-medium">
            Sprache
            <select
              value={form.locale}
              onChange={(event) =>
                setForm((current) => ({ ...current, locale: event.target.value }))
              }
              className="mt-1 h-11 w-full rounded-lg border bg-white px-3"
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="text-sm font-medium md:col-span-2">
            Neues Passwort
            <input
              type="password"
              minLength={12}
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              className="mt-1 h-11 w-full rounded-lg border px-3"
              placeholder="Leer lassen, um es nicht zu ändern"
            />
          </label>
        </div>
        <footer className="border-t p-5">
          <button
            disabled={saving}
            className="h-11 w-full rounded-lg bg-[#ff5a0a] font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function TechnicianMorePage() {
  useTechnicianAccess();
  const links = [
    ['/technician/messages', 'Nachrichten', MessageSquare],
    ['/technician/customers', 'Kunden', UserRound],
    ['/technician/settings', 'Einstellungen', Settings],
    ['/technician/orders', 'Alle Aufträge', FileText],
  ] as const;
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <h1 className="text-2xl font-bold">Mehr</h1>
      <div className="mt-5 overflow-hidden rounded-xl border bg-white">
        {links.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 border-b p-5 last:border-0 hover:bg-slate-50"
          >
            <Icon className="size-5 text-[#ff5a0a]" />
            <span className="flex-1 font-semibold">{label}</span>
            <ChevronRight className="size-5 text-slate-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
