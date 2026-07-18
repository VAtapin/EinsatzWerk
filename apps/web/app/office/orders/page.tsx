'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  MapPin,
  Search,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, getAccessToken } from '@/lib/einsatzwerk-api';

type Technician = {
  id: string;
  name: string;
  phone: string | null;
};

type Order = {
  id: string;
  order_number: string;
  priority: string;
  status: string;
  fault_description: string;
  fault_category: string | null;
  customer_message: string | null;
  dispatcher_notes: string | null;
  created_at: string;
  customer: {
    id: string;
    first_name: string | null;
    last_name: string;
    company_name: string | null;
  };
  service_location: {
    street: string | null;
    house_number: string | null;
    postal_code: string | null;
    city: string | null;
  };
  asset: {
    model: string | null;
    serial_number: string | null;
  } | null;
  visits: Array<{
    id: string;
    status: string;
    planned_start_at: string | null;
    planned_end_at: string | null;
    technician: Technician | null;
  }>;
};

type OrderDetail = Order & {
  appointment_constraints: Array<{
    id: string;
    starts_at: string;
    ends_at: string | null;
    is_hard: boolean;
  }>;
};

const statuses = [
  ['', 'Alle'],
  ['awaiting_scheduling', 'Neu'],
  ['planned', 'Geplant'],
  ['in_progress', 'In Arbeit'],
  ['awaiting_parts', 'Warten auf Teile'],
  ['completed', 'Abgeschlossen'],
  ['cancelled', 'Storniert'],
] as const;

const statusStyle: Record<string, string> = {
  awaiting_scheduling: 'bg-blue-100 text-blue-700',
  planned: 'bg-violet-100 text-violet-700',
  in_progress: 'bg-orange-100 text-orange-700',
  awaiting_parts: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

const statusLabel: Record<string, string> = {
  awaiting_scheduling: 'Neu',
  planned: 'Geplant',
  in_progress: 'In Arbeit',
  awaiting_parts: 'Warten auf Teile',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

const priorityLabel: Record<string, string> = {
  low: 'Niedrig',
  normal: 'Mittel',
  high: 'Hoch',
  urgent: 'Dringend',
};

const priorityStyle: Record<string, string> = {
  low: 'bg-emerald-50 text-emerald-700',
  normal: 'bg-amber-50 text-amber-700',
  high: 'bg-red-50 text-red-700',
  urgent: 'bg-red-600 text-white',
};

function customerName(order: Order): string {
  return (
    order.customer.company_name ||
    [order.customer.first_name, order.customer.last_name]
      .filter(Boolean)
      .join(' ')
  );
}

function location(order: Order): string {
  return [
    order.service_location.street,
    order.service_location.house_number,
    order.service_location.postal_code,
    order.service_location.city,
  ]
    .filter(Boolean)
    .join(' ');
}

function localInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [technicianId, setTechnicianId] = useState('');
  const [start, setStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return localInputValue(date);
  });
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const selected = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? orders[0],
    [orders, selectedId],
  );

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      const result = await apiRequest<{ data: Order[] }>(
        `/service-orders?${params.toString()}`,
      );
      setOrders(result.data);
      setSelectedId((current) =>
        result.data.some(
          (order) =>
            order.id ===
            (typeof window === 'undefined'
              ? current
              : new URLSearchParams(window.location.search).get('order')),
        )
          ? (new URLSearchParams(window.location.search).get('order') as string)
          : result.data.some((order) => order.id === current)
            ? current
            : (result.data[0]?.id ?? ''),
      );
    } catch (error) {
      const statusCode = (error as Error & { status?: number }).status;
      if (statusCode === 401 || statusCode === 403) router.replace('/login');
      else toast.error('Aufträge konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [priority, query, router, status]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load, router]);

  useEffect(() => {
    apiRequest<{ data: Technician[] }>('/technicians')
      .then((result) => {
        setTechnicians(result.data);
        setTechnicianId(result.data[0]?.id ?? '');
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    apiRequest<{ data: OrderDetail }>(`/service-orders/${selectedId}`)
      .then((result) => setDetail(result.data))
      .catch(() =>
        toast.error('Auftragsdetails konnten nicht geladen werden.'),
      );
  }, [selectedId]);

  async function assign() {
    if (!selected || !technicianId) {
      toast.error('Bitte Auftrag und Techniker auswählen.');
      return;
    }

    const startsAt = new Date(start);
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);
    setSaving(true);
    try {
      await apiRequest(`/service-orders/${selected.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          technician_id: technicianId,
          planned_start_at: startsAt.toISOString(),
          planned_end_at: endsAt.toISOString(),
          duration_minutes: duration,
        }),
      });
      toast.success('Einsatz wurde dem Techniker zugewiesen.');
      await load();
    } catch {
      toast.error('Zuweisung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrder() {
    if (!selected || !cancelReason.trim()) return;
    setSaving(true);
    try {
      await apiRequest(`/service-orders/${selected.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      toast.success('Auftrag wurde storniert und der Techniker informiert.');
      setCancelOpen(false);
      setCancelReason('');
      await load();
    } catch {
      toast.error('Auftrag konnte nicht storniert werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-[1120px] px-6 py-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">2. AUFTRÄGE</h1>
          <p className="mt-1 text-sm text-slate-500">
            Alle Aufträge im Überblick
          </p>
        </div>
        <button
          onClick={() => router.push('/office/call-intake')}
          className="h-11 rounded-lg bg-[#ff5a0a] px-5 font-semibold text-white"
        >
          + Neuer Auftrag
        </button>
      </div>

      <div className="mb-5 flex gap-7 border-b">
        {statuses.map(([value, label]) => (
          <button
            key={label}
            onClick={() => setStatus(value)}
            className={`border-b-2 px-1 pb-3 text-sm ${
              status === value
                ? 'border-[#ff5a0a] font-semibold text-[#ff5a0a]'
                : 'border-transparent text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-xl border bg-white p-4">
        <div className="relative flex-1">
          <Search className="absolute top-3 left-3 size-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
            placeholder="Auftrag, Kunde, Adresse oder Problem suchen…"
          />
        </div>
        <button
          onClick={() => setShowFilters((current) => !current)}
          className={`flex h-10 items-center gap-2 rounded-lg border px-4 text-sm ${
            showFilters || priority ? 'border-[#ff5a0a] text-[#ff5a0a]' : ''
          }`}
        >
          <Filter className="size-4" /> Filter
        </button>
      </div>
      {showFilters && (
        <div className="mb-4 flex items-end gap-3 rounded-xl border bg-white p-4">
          <label className="text-xs font-medium">
            Priorität
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="mt-1 block h-10 min-w-52 rounded-lg border bg-white px-3 text-sm"
            >
              <option value="">Alle Prioritäten</option>
              <option value="low">Niedrig</option>
              <option value="normal">Mittel</option>
              <option value="high">Hoch</option>
              <option value="urgent">Dringend</option>
            </select>
          </label>
          <button
            onClick={() => {
              setPriority('');
              setQuery('');
            }}
            className="h-10 rounded-lg border px-4 text-sm"
          >
            Zurücksetzen
          </button>
        </div>
      )}

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <section className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">Auftrag</th>
                <th className="px-4 py-3">Kunde / Adresse</th>
                <th className="px-4 py-3">Problem</th>
                <th className="px-4 py-3">Termin / Techniker</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priorität</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const visit = order.visits[0];
                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    className={`cursor-pointer border-t ${
                      selected?.id === order.id
                        ? 'bg-orange-50/70'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-4 font-medium">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-4">
                      <strong className="block">{customerName(order)}</strong>
                      <span className="text-xs text-slate-500">
                        {location(order)}
                      </span>
                    </td>
                    <td className="max-w-64 px-4 py-4">
                      <span className="line-clamp-2">
                        {order.fault_description}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {visit ? (
                        <>
                          <strong className="block">
                            {new Date(
                              visit.planned_start_at as string,
                            ).toLocaleString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </strong>
                          <span className="text-xs text-slate-500">
                            {visit.technician?.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">Nicht geplant</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded px-2 py-1 text-xs ${statusStyle[order.status] ?? 'bg-slate-100'}`}
                      >
                        {statusLabel[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded px-2 py-1 text-xs ${priorityStyle[order.priority] ?? ''}`}
                      >
                        {priorityLabel[order.priority] ?? order.priority}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <Eye className="size-4 text-slate-500" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && orders.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Keine passenden Aufträge gefunden.
            </div>
          )}
        </section>

        <aside className="h-fit rounded-xl border bg-white">
          {selected ? (
            <>
              <div className="border-b p-5">
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Auftrag {selected.order_number}
                </div>
                <h2 className="mt-3 text-xl font-bold">
                  {customerName(selected)}
                </h2>
                <p className="mt-1 flex gap-2 text-sm text-slate-500">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  {location(selected)}
                </p>
                <p className="mt-4 text-sm">{selected.fault_description}</p>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="size-4 text-[#ff5a0a]" />
                  Einsatz planen
                </div>
                <label className="block text-xs font-medium">Techniker</label>
                <select
                  value={technicianId}
                  onChange={(event) => setTechnicianId(event.target.value)}
                  className="h-11 w-full rounded-lg border px-3"
                >
                  {technicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.name}
                    </option>
                  ))}
                </select>
                <label className="block text-xs font-medium">Beginn</label>
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  className="h-11 w-full rounded-lg border px-3"
                />
                <label className="block text-xs font-medium">
                  Dauer in Minuten
                </label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className="h-11 w-full rounded-lg border px-3"
                />
                <button
                  onClick={assign}
                  disabled={saving || !technicianId}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#ff5a0a] font-semibold text-white disabled:opacity-50"
                >
                  <Check className="size-5" />
                  {saving ? 'Speichern…' : 'Techniker zuweisen'}
                </button>
                {!['completed', 'cancelled'].includes(selected.status) && (
                  <button
                    onClick={() => setCancelOpen(true)}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Ban className="size-4" /> Auftrag stornieren
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 border-t text-sm">
                <button
                  onClick={() =>
                    router.push(
                      `/office/customers?customer=${selected.customer.id}`,
                    )
                  }
                  className="flex items-center justify-center gap-2 border-r p-4"
                >
                  <UserRound className="size-4" /> Kunde
                </button>
                <button
                  onClick={() => setShowDetails(true)}
                  className="flex items-center justify-center gap-2 p-4"
                >
                  <Wrench className="size-4" /> Details
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-slate-500">
              Auftrag auswählen
            </div>
          )}
        </aside>
      </div>

      {cancelOpen && selected && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#061b31]/60 p-6 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-bold">Auftrag stornieren</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.order_number} · {customerName(selected)}
                </p>
              </div>
              <button onClick={() => setCancelOpen(false)}>
                <X className="size-5 text-slate-400" />
              </button>
            </header>
            <div className="p-5">
              <label className="text-sm font-medium">
                Grund der Stornierung
                <textarea
                  autoFocus
                  required
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  className="mt-2 min-h-32 w-full rounded-lg border p-3"
                  placeholder="z. B. Kunde hat Termin abgesagt…"
                />
              </label>
            </div>
            <footer className="flex justify-end gap-3 border-t p-5">
              <button
                onClick={() => setCancelOpen(false)}
                className="h-11 rounded-lg border px-5"
              >
                Abbrechen
              </button>
              <button
                disabled={saving || !cancelReason.trim()}
                onClick={() => void cancelOrder()}
                className="h-11 rounded-lg bg-red-600 px-5 font-semibold text-white disabled:opacity-50"
              >
                Verbindlich stornieren
              </button>
            </footer>
          </section>
        </div>
      )}

      <div className="mt-4 grid grid-cols-4 gap-3">
        {[
          { label: 'Offene Aufträge', value: orders.length, icon: Clock3 },
          {
            label: 'Ungeplant',
            value: orders.filter((order) => order.visits.length === 0).length,
            icon: CalendarDays,
          },
          {
            label: 'In Arbeit',
            value: orders.filter((order) => order.status === 'in_progress')
              .length,
            icon: Wrench,
          },
          {
            label: 'Warten auf Teile',
            value: orders.filter((order) => order.status === 'awaiting_parts')
              .length,
            icon: Filter,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl border bg-white p-4"
          >
            <Icon className="size-7 text-[#ff5a0a]" />
            <div>
              <div className="text-xs text-slate-500">{label}</div>
              <strong className="text-2xl">{value}</strong>
            </div>
          </div>
        ))}
      </div>

      {showDetails && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b p-6">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Auftrag {detail.order_number}
                </div>
                <h2 className="mt-2 text-2xl font-bold">
                  {customerName(detail)}
                </h2>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Schließen
              </button>
            </header>
            <div className="grid grid-cols-2 gap-5 p-6 text-sm">
              <div className="rounded-xl border p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Problem
                </div>
                <div className="mt-2 font-semibold">
                  {detail.fault_category || 'Ohne Kategorie'}
                </div>
                <p className="mt-2 whitespace-pre-wrap">
                  {detail.fault_description}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Status
                </div>
                <div className="mt-2">
                  {statusLabel[detail.status] ?? detail.status} ·{' '}
                  {priorityLabel[detail.priority] ?? detail.priority}
                </div>
                <div className="mt-4 text-xs font-semibold text-slate-500 uppercase">
                  Adresse
                </div>
                <p className="mt-2">{location(detail)}</p>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Kundenmitteilung
                </div>
                <p className="mt-2 whitespace-pre-wrap text-slate-600">
                  {detail.customer_message || 'Keine Mitteilung.'}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Disposition
                </div>
                <p className="mt-2 whitespace-pre-wrap text-slate-600">
                  {detail.dispatcher_notes || 'Keine internen Hinweise.'}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Terminwünsche
                </div>
                {detail.appointment_constraints.length ? (
                  detail.appointment_constraints.map((appointment) => (
                    <div key={appointment.id} className="mt-2">
                      {new Date(appointment.starts_at).toLocaleString('de-DE')}
                      {appointment.ends_at
                        ? ` – ${new Date(appointment.ends_at).toLocaleString('de-DE')}`
                        : ''}
                      {appointment.is_hard ? ' · fest zugesagt' : ''}
                    </div>
                  ))
                ) : (
                  <p className="mt-2 text-slate-500">Kein Terminwunsch.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
