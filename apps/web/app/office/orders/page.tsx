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
  Mail,
  MapPin,
  PackageOpen,
  Phone,
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

type CustomerAsset = {
  id: string;
  model: string | null;
  serial_number: string | null;
  production_number: string | null;
  purchase_date: string | null;
  status: string;
  manufacturer: { id: string; name: string } | null;
};

type CustomerDetail = {
  id: string;
  customer_number: string;
  legacy_customer_number: string | null;
  first_name: string | null;
  last_name: string;
  company_name: string | null;
  primary_phone: string | null;
  secondary_phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  service_locations: Array<{
    id: string;
    name: string | null;
    contact_person: string | null;
    street: string | null;
    house_number: string | null;
    postal_code: string | null;
    city: string | null;
    access_notes: string | null;
    parking_notes: string | null;
    is_primary: boolean;
  }>;
  assets: CustomerAsset[];
  service_orders: Array<{ id: string }>;
  documents: Array<{ id: string }>;
};

type OrderItem = {
  id: string;
  legacy_art: string | null;
  article_number: string | null;
  code: string | null;
  line_date: string | null;
  description: string | null;
  additional_text: string | null;
  quantity: string | null;
  net_unit_price: string | null;
  gross_unit_price: string | null;
  serial_number: string | null;
  classification: string;
  classification_confidence: string;
  device_type: string | null;
  assets: Array<{
    id: string;
    model: string | null;
    serial_number: string | null;
    status: string;
  }>;
};

type Order = {
  id: string;
  order_number: string;
  priority: string;
  status: string;
  source: string;
  items_count: number;
  fault_description: string;
  fault_category: string | null;
  customer_message: string | null;
  dispatcher_notes: string | null;
  preferred_date: string | null;
  gross_total: number | string;
  created_at: string;
  items: OrderItem[];
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

const classificationLabel: Record<string, string> = {
  device: 'Gerät',
  spare_part: 'Ersatzteil',
  labor: 'Arbeitsleistung',
  delivery: 'Lieferung',
  disposal: 'Altgerät',
  inspection: 'Prüfung',
  warranty: 'Garantie',
  discount: 'Rabatt / Gutschrift',
  furniture: 'Möbel',
  accessory: 'Zubehör',
  structural: 'Gliederung',
  other: 'Unklar',
};

function customerName(order: Order): string {
  return (
    order.customer.company_name ||
    [order.customer.first_name, order.customer.last_name]
      .filter(Boolean)
      .join(' ')
  );
}

function customerDetailName(customer: CustomerDetail): string {
  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(' ')
  );
}

function customerAssetLabel(asset: CustomerAsset): string {
  return (
    [asset.manufacturer?.name, asset.model].filter(Boolean).join(' ').trim() ||
    'Gerät ohne Bezeichnung'
  );
}

function customerAssetGroupKey(asset: CustomerAsset): string {
  return [asset.manufacturer?.name ?? '', asset.model ?? '']
    .join(' ')
    .trim()
    .toLocaleLowerCase('de-DE')
    .replace(/\s+/g, ' ');
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

function orderDate(order: Order): Date {
  return new Date(order.preferred_date || order.created_at);
}

function orderSummary(order: Order): string {
  const descriptions = Array.from(
    new Set(
      order.items
        .filter(
          (item) =>
            item.classification !== 'structural' && item.description?.trim(),
        )
        .map((item) => item.description?.trim() as string),
    ),
  );

  if (descriptions.length) {
    return descriptions.slice(0, 2).join(' · ');
  }

  return order.fault_description?.trim() || 'Keine Beschreibung';
}

function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';

  return Number(value).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
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
  const [source, setSource] = useState('');
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
  const [selectedCustomerDetail, setSelectedCustomerDetail] =
    useState<CustomerDetail | null>(null);
  const [loadingCustomerId, setLoadingCustomerId] = useState('');
  const [expandedCustomerAssetGroup, setExpandedCustomerAssetGroup] =
    useState('');

  const selected = useMemo(
    () =>
      orders.find((order) => order.id === selectedId) ??
      (detail?.id === selectedId ? detail : orders[0]),
    [detail, orders, selectedId],
  );

  const customerAssetGroups = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; assets: CustomerAsset[] }
    >();

    for (const asset of selectedCustomerDetail?.assets ?? []) {
      const key = customerAssetGroupKey(asset) || `asset-${asset.id}`;
      const current = groups.get(key);
      if (current) current.assets.push(asset);
      else {
        groups.set(key, {
          label: customerAssetLabel(asset),
          assets: [asset],
        });
      }
    }

    return Array.from(groups.entries())
      .map(([key, group]) => ({ key, ...group }))
      .sort(
        (left, right) =>
          right.assets.length - left.assets.length ||
          left.label.localeCompare(right.label, 'de'),
      );
  }, [selectedCustomerDetail?.assets]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      if (source) params.set('source', source);
      const result = await apiRequest<{ data: Order[] }>(
        `/service-orders?${params.toString()}`,
      );
      setOrders(result.data);
      const requestedOrder =
        typeof window === 'undefined'
          ? null
          : new URLSearchParams(window.location.search).get('order');
      const shouldOpen =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('open') === '1';
      setSelectedId((current) =>
        requestedOrder
          ? (requestedOrder as string)
          : result.data.some((order) => order.id === current)
            ? current
            : (result.data[0]?.id ?? ''),
      );
      if (shouldOpen && requestedOrder) {
        setShowDetails(true);
      }
    } catch (error) {
      const statusCode = (error as Error & { status?: number }).status;
      if (statusCode === 401 || statusCode === 403) router.replace('/login');
      else toast.error('Aufträge konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [priority, query, router, source, status]);

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

  useEffect(() => {
    if (!showDetails && !cancelOpen && !selectedCustomerDetail) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (selectedCustomerDetail) {
        setSelectedCustomerDetail(null);
        setExpandedCustomerAssetGroup('');
        return;
      }

      if (cancelOpen) {
        setCancelOpen(false);
        setCancelReason('');
        return;
      }

      setShowDetails(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [cancelOpen, selectedCustomerDetail, showDetails]);

  async function openCustomer(customerId: string) {
    setLoadingCustomerId(customerId);
    try {
      const result = await apiRequest<{ data: CustomerDetail }>(
        `/customers/${customerId}`,
      );
      setExpandedCustomerAssetGroup('');
      setSelectedCustomerDetail(result.data);
    } catch {
      toast.error('Kundendetails konnten nicht geladen werden.');
    } finally {
      setLoadingCustomerId('');
    }
  }

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
          <label className="text-xs font-medium">
            Herkunft
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="mt-1 block h-10 min-w-52 rounded-lg border bg-white px-3 text-sm"
            >
              <option value="">Alle Aufträge</option>
              <option value="legacy">Datenübernahme</option>
              <option value="phone">Telefonannahme</option>
              <option value="manual">Manuell</option>
              <option value="technician">Techniker</option>
            </select>
          </label>
          <button
            onClick={() => {
              setPriority('');
              setSource('');
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
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Kunde / Adresse</th>
                <th className="px-4 py-3">Inhalt</th>
                <th className="px-4 py-3 text-right">Positionen</th>
                <th className="px-4 py-3 text-right">Gesamt brutto</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => {
                    setSelectedId(order.id);
                    setShowDetails(true);
                  }}
                  className={`cursor-pointer border-t ${
                    selected?.id === order.id
                      ? 'bg-orange-50/70'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-4 py-4 font-medium">
                    {order.order_number}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    {orderDate(order).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openCustomer(order.customer.id);
                      }}
                      className={`block text-left font-semibold text-blue-600 hover:underline ${
                        loadingCustomerId === order.customer.id
                          ? 'opacity-60'
                          : ''
                      }`}
                    >
                      {customerName(order)}
                    </button>
                    <span className="text-xs text-slate-500">
                      {location(order)}
                    </span>
                  </td>
                  <td className="max-w-64 px-4 py-4">
                    <span className="line-clamp-2">{orderSummary(order)}</span>
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    {order.items_count}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums">
                    {formatMoney(order.gross_total)}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded px-2 py-1 text-xs ${statusStyle[order.status] ?? 'bg-slate-100'}`}
                    >
                      {statusLabel[order.status] ?? order.status}
                    </span>
                    {order.source !== 'legacy' && (
                      <span
                        className={`ml-2 rounded px-2 py-1 text-xs ${priorityStyle[order.priority] ?? ''}`}
                      >
                        {priorityLabel[order.priority] ?? order.priority}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <button
                      type="button"
                      aria-label={`Auftrag ${order.order_number} öffnen`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(order.id);
                        setShowDetails(true);
                      }}
                      className="rounded-lg border p-2 text-slate-500 hover:border-[#ff5a0a] hover:text-[#ff5a0a]"
                    >
                      <Eye className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
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
                <p className="mt-4 text-sm">{orderSummary(selected)}</p>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="block text-slate-500">Datum</span>
                    <strong>
                      {orderDate(selected).toLocaleDateString('de-DE')}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-slate-500">Positionen</span>
                    <strong>{selected.items_count}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-500">Gesamt</span>
                    <strong>{formatMoney(selected.gross_total)}</strong>
                  </div>
                </div>
              </div>
              {selected.source !== 'legacy' &&
              !['completed', 'cancelled'].includes(selected.status) ? (
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
                    onChange={(event) =>
                      setDuration(Number(event.target.value))
                    }
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
                  <button
                    onClick={() => setCancelOpen(true)}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Ban className="size-4" /> Auftrag stornieren
                  </button>
                </div>
              ) : (
                <div className="p-5 text-sm text-slate-600">
                  <div className="rounded-lg bg-emerald-50 p-4">
                    Auftrag{' '}
                    {statusLabel[selected.status]?.toLowerCase() ??
                      selected.status}
                    . Alle Positionen sind über die Tabelle oder das Auge
                    einsehbar.
                  </div>
                </div>
              )}
              <div className="border-t text-sm">
                <button
                  onClick={() => void openCustomer(selected.customer.id)}
                  disabled={loadingCustomerId === selected.customer.id}
                  className="flex w-full items-center justify-center gap-2 p-4"
                >
                  <UserRound className="size-4" /> Kunde
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
                <button
                  type="button"
                  onClick={() => void openCustomer(detail.customer.id)}
                  className="mt-2 text-left text-2xl font-bold text-blue-700 hover:underline"
                >
                  {customerName(detail)}
                </button>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Schließen
              </button>
            </header>
            <div className="grid grid-cols-2 gap-5 p-6 text-sm">
              {detail.source === 'legacy' ? (
                <div className="rounded-xl border p-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase">
                    Auftragsübersicht
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs text-slate-500">Datum</dt>
                      <dd className="font-semibold">
                        {orderDate(detail).toLocaleDateString('de-DE')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Positionen</dt>
                      <dd className="font-semibold">{detail.items.length}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500">Gesamt brutto</dt>
                      <dd className="text-lg font-bold">
                        {formatMoney(detail.gross_total)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
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
              )}
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
              <div className="col-span-2 overflow-hidden rounded-xl border">
                <div className="border-b bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Positionen ({detail.items.length})
                </div>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Artikel / Code</th>
                      <th className="px-4 py-3">Bezeichnung</th>
                      <th className="px-4 py-3">Typ</th>
                      <th className="px-4 py-3 text-right">Menge</th>
                      <th className="px-4 py-3 text-right">Brutto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id} className="border-t align-top">
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {item.article_number || '—'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.code || 'ohne Code'}
                          </div>
                        </td>
                        <td className="max-w-md px-4 py-3">
                          <div className="font-medium">
                            {item.description || '—'}
                          </div>
                          {item.additional_text && (
                            <div className="mt-1 whitespace-pre-wrap text-xs text-slate-500">
                              {item.additional_text}
                            </div>
                          )}
                          {item.serial_number && (
                            <div className="mt-1 text-xs">
                              SN: {item.serial_number}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-1 text-xs ${
                              item.classification === 'device'
                                ? 'bg-blue-100 text-blue-700'
                                : item.classification === 'other'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {classificationLabel[item.classification] ||
                              item.classification}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.quantity || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.gross_unit_price
                            ? `${Number(item.gross_unit_price).toLocaleString(
                                'de-DE',
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                },
                              )} €`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detail.items.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    Keine Positionen vorhanden.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {selectedCustomerDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-6">
          <section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b p-6">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Kunde {selectedCustomerDetail.customer_number}
                </div>
                <h2 className="mt-2 text-2xl font-bold">
                  {customerDetailName(selectedCustomerDetail)}
                </h2>
                {selectedCustomerDetail.legacy_customer_number && (
                  <div className="mt-1 text-xs text-slate-500">
                    Alte Kundennummer:{' '}
                    {selectedCustomerDetail.legacy_customer_number}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerDetail(null);
                  setExpandedCustomerAssetGroup('');
                }}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Schließen
              </button>
            </header>

            <div className="grid grid-cols-[1fr_1fr] gap-5 p-6">
              <div className="space-y-5">
                <section className="rounded-xl border p-5">
                  <div className="text-xs font-semibold text-slate-500 uppercase">
                    Kontaktdaten
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Phone className="size-4 text-slate-400" />
                      {selectedCustomerDetail.primary_phone ? (
                        <a
                          href={`tel:${selectedCustomerDetail.primary_phone}`}
                          className="font-medium text-blue-600"
                        >
                          {selectedCustomerDetail.primary_phone}
                        </a>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="size-4 text-slate-400" />
                      <span>
                        {selectedCustomerDetail.secondary_phone || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="size-4 text-slate-400" />
                      {selectedCustomerDetail.email ? (
                        <a
                          href={`mailto:${selectedCustomerDetail.email}`}
                          className="font-medium text-blue-600"
                        >
                          {selectedCustomerDetail.email}
                        </a>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>
                  {selectedCustomerDetail.notes && (
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      {selectedCustomerDetail.notes}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border">
                  <div className="border-b px-5 py-4 font-bold">
                    Serviceadressen (
                    {selectedCustomerDetail.service_locations.length})
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {selectedCustomerDetail.service_locations.map(
                      (serviceLocation, index) => (
                        <div
                          key={serviceLocation.id}
                          className="border-b p-4 text-sm last:border-b-0"
                        >
                          <div className="flex items-center gap-2 font-semibold">
                            <span className="flex size-6 items-center justify-center rounded-full bg-orange-100 text-xs text-[#ff5a0a]">
                              {index + 1}
                            </span>
                            {serviceLocation.name ||
                              (serviceLocation.is_primary
                                ? 'Hauptadresse'
                                : 'Serviceadresse')}
                          </div>
                          <div className="mt-2 pl-8">
                            <div>
                              {[
                                serviceLocation.street,
                                serviceLocation.house_number,
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            </div>
                            <div>
                              {[
                                serviceLocation.postal_code,
                                serviceLocation.city,
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            </div>
                            {serviceLocation.contact_person && (
                              <div className="mt-2 text-xs text-slate-500">
                                Kontakt: {serviceLocation.contact_person}
                              </div>
                            )}
                            {serviceLocation.access_notes && (
                              <div className="text-xs text-slate-500">
                                Zugang: {serviceLocation.access_notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </section>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    ['Aufträge', selectedCustomerDetail.service_orders.length],
                    ['Geräte', selectedCustomerDetail.assets.length],
                    ['Dokumente', selectedCustomerDetail.documents.length],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border bg-slate-50 p-4 text-center"
                    >
                      <div className="text-xs text-slate-500">{label}</div>
                      <strong className="mt-1 block text-xl">{value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <section className="h-fit overflow-hidden rounded-xl border">
                <div className="border-b px-5 py-4 font-bold">
                  Geräte beim Kunden ({selectedCustomerDetail.assets.length})
                </div>
                <div className="max-h-[620px] overflow-y-auto">
                  {customerAssetGroups.map((group) => {
                    const expanded = expandedCustomerAssetGroup === group.key;

                    return (
                      <div key={group.key} className="border-b last:border-b-0">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCustomerAssetGroup(
                              expanded ? '' : group.key,
                            )
                          }
                          className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"
                        >
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                            <PackageOpen className="size-6 text-slate-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">
                              {group.label}
                            </div>
                            <div className="text-xs text-slate-500">
                              {
                                group.assets.filter(
                                  (asset) => asset.status === 'active',
                                ).length
                              }{' '}
                              aktiv
                            </div>
                          </div>
                          <span className="rounded-full bg-[#ff5a0a] px-2.5 py-1 text-xs font-bold text-white">
                            × {group.assets.length}
                          </span>
                          <ChevronRight
                            className={`size-4 text-slate-400 transition-transform ${
                              expanded ? 'rotate-90' : ''
                            }`}
                          />
                        </button>
                        {expanded && (
                          <div className="border-t bg-slate-50/70">
                            {group.assets.map((asset, index) => (
                              <div
                                key={asset.id}
                                className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 text-xs last:border-b-0"
                              >
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white font-semibold text-slate-500">
                                  {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold">
                                    SN: {asset.serial_number || '—'} · FD:{' '}
                                    {asset.production_number || '—'}
                                  </div>
                                  <div className="mt-0.5 text-slate-500">
                                    {asset.purchase_date
                                      ? new Date(
                                          asset.purchase_date,
                                        ).toLocaleDateString('de-DE')
                                      : 'Datum unbekannt'}
                                  </div>
                                </div>
                                <span
                                  className={`rounded px-2 py-1 ${
                                    asset.status === 'active'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {asset.status === 'active'
                                    ? 'Aktiv'
                                    : 'Inaktiv'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {customerAssetGroups.length === 0 && (
                    <div className="p-10 text-center text-sm text-slate-500">
                      Keine Geräte erfasst.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
