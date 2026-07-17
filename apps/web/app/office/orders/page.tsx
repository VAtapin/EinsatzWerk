'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
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
  created_at: string;
  customer: {
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

const statuses = [
  ['', 'Alle'],
  ['awaiting_scheduling', 'Neu'],
  ['planned', 'Geplant'],
  ['in_progress', 'In Arbeit'],
  ['awaiting_parts', 'Warten auf Teile'],
  ['completed', 'Abgeschlossen'],
] as const;

const statusStyle: Record<string, string> = {
  awaiting_scheduling: 'bg-blue-100 text-blue-700',
  planned: 'bg-violet-100 text-violet-700',
  in_progress: 'bg-orange-100 text-orange-700',
  awaiting_parts: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
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
  const [selectedId, setSelectedId] = useState('');
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

  const selected = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? orders[0],
    [orders, selectedId],
  );

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status) params.set('status', status);
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
  }, [query, router, status]);

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

  return (
    <div className="min-w-[1120px] px-6 py-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">2. AUFTRÄGE</h1>
          <p className="mt-1 text-sm text-slate-500">
            Alle Aufträge im Überblick
          </p>
        </div>
        <button className="h-11 rounded-lg bg-[#ff5a0a] px-5 font-semibold text-white">
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
        <button className="flex h-10 items-center gap-2 rounded-lg border px-4 text-sm">
          <Filter className="size-4" /> Filter
        </button>
      </div>

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
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded px-2 py-1 text-xs ${priorityStyle[order.priority] ?? ''}`}
                      >
                        {order.priority}
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
              </div>
              <div className="grid grid-cols-2 border-t text-sm">
                <button className="flex items-center justify-center gap-2 border-r p-4">
                  <UserRound className="size-4" /> Kunde
                </button>
                <button className="flex items-center justify-center gap-2 p-4">
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
    </div>
  );
}
