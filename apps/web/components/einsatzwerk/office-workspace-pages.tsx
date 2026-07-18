'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Boxes,
  CheckCircle2,
  Copy,
  FileDown,
  FileText,
  MapPin,
  MessageSquare,
  PackageOpen,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  Trash2,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiDownload, apiRequest, getAccessToken } from '@/lib/einsatzwerk-api';

function useOfficeAccess() {
  const router = useRouter();
  useEffect(() => {
    if (!getAccessToken()) router.replace('/login');
  }, [router]);
  return router;
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

type AnalyticsData = {
  summary: Record<string, number>;
  status_counts: Record<string, number>;
  daily_orders: Array<{ day: string; total: number }>;
  top_problems: Array<{ fault_category: string; total: number }>;
  technicians: Array<{
    id: string;
    name: string;
    status: string;
    visits_today: number;
    visits_open: number;
  }>;
};

const statusNames: Record<string, string> = {
  awaiting_scheduling: 'Neu',
  planned: 'Geplant',
  in_progress: 'In Arbeit',
  awaiting_parts: 'Warten auf Teile',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

function useAnalytics() {
  const router = useOfficeAccess();
  const [data, setData] = useState<AnalyticsData | null>(null);
  useEffect(() => {
    apiRequest<{ data: AnalyticsData }>('/office/analytics')
      .then((result) => setData(result.data))
      .catch((error) => {
        if ((error as Error & { status?: number }).status === 401) {
          router.replace('/login');
        } else {
          toast.error('Kennzahlen konnten nicht geladen werden.');
        }
      });
  }, [router]);
  return data;
}

export function AnalyticsPage() {
  const data = useAnalytics();
  const summary = data?.summary ?? {};
  const maximum = Math.max(
    1,
    ...(data?.daily_orders.map((point) => point.total) ?? []),
  );
  const cards = [
    ['Aufträge gesamt', summary.orders ?? 0, BarChart3],
    ['Abgeschlossen', summary.completed ?? 0, CheckCircle2],
    ['Aktive Einsätze', summary.active ?? 0, Activity],
    ['Warten auf Teile', summary.awaiting_parts ?? 0, Boxes],
    ['Kunden', summary.customers ?? 0, Users],
    ['Geräte', summary.assets ?? 0, PackageOpen],
  ] as const;

  return (
    <div className="min-w-[1120px] px-6 py-6">
      <PageHeader
        title="4. ANALYTIK & BERICHTE"
        description="Kennzahlen und Auswertungen für die Disposition"
      />
      <div className="grid grid-cols-6 gap-3">
        {cards.map(([label, value, Icon]) => (
          <section key={label} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <Icon className="size-5 text-[#ff5a0a]" />
            </div>
            <strong className="mt-3 block text-2xl">{value}</strong>
          </section>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-[1.5fr_1fr_1fr] gap-4">
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Aufträge der letzten 14 Tage</h2>
          <div className="mt-6 flex h-64 items-end gap-2">
            {data?.daily_orders.map((point) => (
              <div
                key={point.day}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <span className="text-xs font-semibold">{point.total}</span>
                <div
                  className="w-full rounded-t bg-blue-500"
                  style={{
                    height: `${Math.max(8, (point.total / maximum) * 190)}px`,
                  }}
                />
                <span className="text-[10px] text-slate-500">
                  {new Date(point.day).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
              </div>
            ))}
            {!data?.daily_orders.length && (
              <div className="m-auto text-sm text-slate-500">
                Noch keine Aufträge.
              </div>
            )}
          </div>
        </section>
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Aufträge nach Status</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(data?.status_counts ?? {}).map(
              ([status, total]) => (
                <div key={status}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{statusNames[status] ?? status}</span>
                    <strong>{total}</strong>
                  </div>
                  <div className="h-2 rounded bg-slate-100">
                    <div
                      className="h-2 rounded bg-[#ff5a0a]"
                      style={{
                        width: `${Math.max(4, (total / Math.max(1, summary.orders ?? 0)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Häufige Probleme</h2>
          <div className="mt-4 divide-y">
            {data?.top_problems.map((problem) => (
              <div
                key={problem.fault_category}
                className="flex justify-between py-3 text-sm"
              >
                <span>{problem.fault_category}</span>
                <strong>{problem.total}</strong>
              </div>
            ))}
            {!data?.top_problems.length && (
              <p className="py-8 text-center text-sm text-slate-500">
                Kategorien werden mit neuen Aufträgen aufgebaut.
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="mt-4 rounded-xl border bg-white">
        <div className="border-b p-4 font-bold">Techniker-Auslastung heute</div>
        <div className="grid grid-cols-4 gap-3 p-4">
          {data?.technicians.map((technician) => (
            <div key={technician.id} className="rounded-lg border p-4">
              <div className="font-semibold">{technician.name}</div>
              <div className="mt-2 text-sm text-slate-500">
                {technician.visits_today} heute · {technician.visits_open} offen
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type AssetItem = {
  id: string;
  model: string | null;
  serial_number: string | null;
  production_number: string | null;
  legacy_article_id: string | null;
  purchase_date: string | null;
  notes: string | null;
  status: string;
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
  } | null;
  manufacturer: { name: string } | null;
  source_order_item: {
    id: string;
    code: string | null;
    additional_text: string | null;
    service_order: { id: string; order_number: string };
  } | null;
};

export function AssetsPage() {
  const router = useOfficeAccess();
  const [items, setItems] = useState<AssetItem[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const load = useCallback(async () => {
    const parameters = new URLSearchParams();
    if (query.trim()) parameters.set('q', query.trim());
    if (status) parameters.set('status', status);
    try {
      const result = await apiRequest<{ data: AssetItem[] }>(
        `/assets?${parameters.toString()}`,
      );
      setItems(result.data);
    } catch {
      toast.error('Geräte konnten nicht geladen werden.');
    }
  }, [query, status]);
  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="min-w-[1080px] px-6 py-6">
      <PageHeader
        title="GERÄTE"
        description="Kundengeräte, Seriennummern und Standorte"
        action={
          <button
            onClick={() => router.push('/office/call-intake')}
            className="flex h-11 items-center gap-2 rounded-lg bg-[#061b31] px-5 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> Gerät beim Kunden anlegen
          </button>
        }
      />
      <div className="mb-4 flex gap-3 rounded-xl border bg-white p-4">
        <div className="relative flex-1">
          <Search className="absolute top-3 left-3 size-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
            placeholder="Modell, Seriennummer, Kunde oder Artikelnummer…"
          />
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-lg border bg-white px-3 text-sm"
        >
          <option value="">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="inactive">Inaktiv</option>
        </select>
      </div>
      <section className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">Gerät</th>
              <th className="px-4 py-3">SN / FD</th>
              <th className="px-4 py-3">Kunde</th>
              <th className="px-4 py-3">Auftrag / Kauf</th>
              <th className="px-4 py-3">Standort</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((asset) => (
              <tr
                key={asset.id}
                onClick={() =>
                  router.push(`/office/customers?customer=${asset.customer.id}`)
                }
                className="cursor-pointer border-t hover:bg-slate-50"
              >
                <td className="max-w-72 px-4 py-4">
                  <div className="font-semibold">
                    {[asset.manufacturer?.name, asset.model]
                      .filter(Boolean)
                      .join(' ') || 'Gerät'}
                  </div>
                  {(asset.source_order_item?.additional_text || asset.notes) && (
                    <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {asset.source_order_item?.additional_text || asset.notes}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-slate-600">
                  <div>SN: {asset.serial_number || '—'}</div>
                  <div className="text-xs">
                    FD: {asset.production_number || '—'}
                  </div>
                </td>
                <td className="px-4 py-4">
                  {asset.customer.company_name ||
                    [asset.customer.first_name, asset.customer.last_name]
                      .filter(Boolean)
                      .join(' ')}
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-blue-600">
                    {asset.source_order_item?.service_order.order_number || '—'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {asset.purchase_date
                      ? new Date(asset.purchase_date).toLocaleDateString('de-DE')
                      : 'ohne Datum'}
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-500">
                  {asset.service_location
                    ? [
                        asset.service_location.street,
                        asset.service_location.house_number,
                        asset.service_location.postal_code,
                        asset.service_location.city,
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : '—'}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded px-2 py-1 text-xs ${
                      asset.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {asset.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <div className="p-12 text-center text-sm text-slate-500">
            Keine Geräte gefunden.
          </div>
        )}
      </section>
    </div>
  );
}

type TechnicianItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  visits_total: number;
  visits_open: number;
  visits_today: number;
  assigned_visits: Array<{
    id: string;
    status: string;
    planned_start_at: string;
    service_order: {
      order_number: string;
      customer: { first_name: string | null; last_name: string };
      service_location: { city: string | null };
    };
  }>;
};

export function TechniciansPage() {
  useOfficeAccess();
  const [items, setItems] = useState<TechnicianItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'active',
    password: '',
  });
  const load = useCallback(async () => {
    const result = await apiRequest<{ data: TechnicianItem[] }>(
      '/technicians/workspace',
    );
    setItems(result.data);
  }, []);
  useEffect(() => {
    load().catch(() => toast.error('Techniker konnten nicht geladen werden.'));
  }, [load]);
  function openTechnician(technician?: TechnicianItem) {
    setEditing(technician?.id ?? '');
    setForm({
      name: technician?.name ?? '',
      email: technician?.email ?? '',
      phone: technician?.phone ?? '',
      status: technician?.status ?? 'active',
      password: '',
    });
  }
  async function saveTechnician(event: FormEvent) {
    event.preventDefault();
    const isNew = editing === '';
    setSaving(true);
    try {
      await apiRequest(
        isNew ? '/technicians' : `/technicians/${editing as string}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          body: JSON.stringify(form),
        },
      );
      await load();
      setEditing(null);
      toast.success(
        isNew ? 'Techniker wurde angelegt.' : 'Techniker wurde gespeichert.',
      );
    } catch {
      toast.error('Techniker konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-[1080px] px-6 py-6">
      <PageHeader
        title="7. TECHNIKER"
        description="Techniker verwalten und Einsätze überwachen"
        action={
          <button
            onClick={() => openTechnician()}
            className="flex h-11 items-center gap-2 rounded-lg bg-[#061b31] px-5 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> Neuer Techniker
          </button>
        }
      />
      <div className="mb-4 grid grid-cols-4 gap-3">
        {[
          {
            label: 'Techniker gesamt',
            value: items.length,
            Icon: Users,
          },
          {
            label: 'Heute im Einsatz',
            value: items.filter((item) => item.visits_today > 0).length,
            Icon: Activity,
          },
          {
            label: 'Verfügbar',
            value: items.filter(
              (item) => item.status === 'active' && item.visits_today === 0,
            ).length,
            Icon: CheckCircle2,
          },
          {
            label: 'Offene Einsätze',
            value: items.reduce((sum, item) => sum + item.visits_open, 0),
            Icon: Wrench,
          },
        ].map(({ label, value, Icon }) => (
          <section key={label} className="rounded-xl border bg-white p-4">
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <Icon className="size-5 text-[#ff5a0a]" />
            </div>
            <strong className="mt-2 block text-2xl">{value}</strong>
          </section>
        ))}
      </div>
      <section className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">Techniker</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Heute</th>
              <th className="px-4 py-3">Offen / Gesamt</th>
              <th className="px-4 py-3">Heutige Einsätze</th>
              <th className="w-14 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((technician) => (
              <tr key={technician.id} className="border-t align-top">
                <td className="px-4 py-4">
                  <div className="font-semibold">{technician.name}</div>
                  <div className="text-xs text-slate-500">
                    {technician.email}
                  </div>
                  <div className="text-xs text-slate-500">
                    {technician.phone || '—'}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                    {technician.status === 'active'
                      ? 'Aktiv'
                      : technician.status}
                  </span>
                </td>
                <td className="px-4 py-4 font-semibold">
                  {technician.visits_today}
                </td>
                <td className="px-4 py-4">
                  {technician.visits_open} / {technician.visits_total}
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    {technician.assigned_visits.map((visit) => (
                      <div
                        key={visit.id}
                        className="rounded bg-slate-50 px-3 py-2 text-xs"
                      >
                        {new Date(visit.planned_start_at).toLocaleTimeString(
                          'de-DE',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                          },
                        )}{' '}
                        · {visit.service_order.order_number} ·{' '}
                        {visit.service_order.customer.last_name}
                      </div>
                    ))}
                    {!technician.assigned_visits.length && (
                      <span className="text-slate-400">
                        Keine Einsätze heute
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => openTechnician(technician)}
                    className="rounded-lg border p-2 hover:bg-slate-50"
                    aria-label={`${technician.name} bearbeiten`}
                  >
                    <Pencil className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6">
          <form
            onSubmit={saveTechnician}
            className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-bold">
                {editing === '' ? 'Neuer Techniker' : 'Techniker bearbeiten'}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Schließen
              </button>
            </header>
            <div className="grid grid-cols-2 gap-4 p-5">
              {[
                ['name', 'Name', true, 'text'],
                ['email', 'E-Mail', true, 'email'],
                ['phone', 'Telefon', false, 'text'],
                [
                  'password',
                  editing === '' ? 'Initiales Passwort' : 'Neues Passwort',
                  editing === '',
                  'password',
                ],
              ].map(([field, label, required, type]) => (
                <label key={field as string} className="text-sm font-medium">
                  {label as string}
                  <input
                    required={required as boolean}
                    minLength={field === 'password' ? 12 : undefined}
                    type={type as string}
                    value={form[field as keyof typeof form]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field as string]: event.target.value,
                      }))
                    }
                    className="mt-1 h-11 w-full rounded-lg border px-3"
                  />
                </label>
              ))}
              {editing !== '' && (
                <label className="text-sm font-medium">
                  Status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                    className="mt-1 h-11 w-full rounded-lg border bg-white px-3"
                  >
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv</option>
                  </select>
                </label>
              )}
            </div>
            <footer className="flex justify-end gap-3 border-t p-5">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-11 rounded-lg border px-5"
              >
                Abbrechen
              </button>
              <button
                disabled={saving}
                className="h-11 rounded-lg bg-[#ff5a0a] px-6 font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

type ServiceAreaItem = {
  id: string;
  code: string;
  name: string;
  color: string | null;
  active: boolean;
  postal_codes_count: number;
  postal_codes: Array<{
    id: string;
    postal_code: string;
    city: string | null;
    dialing_code: string | null;
  }>;
};

export function ServiceAreasPage() {
  useOfficeAccess();
  const [items, setItems] = useState<ServiceAreaItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [postalArea, setPostalArea] = useState<string | null>(null);
  const [areaForm, setAreaForm] = useState({
    code: '',
    name: '',
    color: '#ff5a0a',
    active: true,
  });
  const [postalForm, setPostalForm] = useState({
    postal_code: '',
    city: '',
    dialing_code: '',
  });
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const result = await apiRequest<{ data: ServiceAreaItem[] }>(
      '/service-areas',
    );
    setItems(result.data);
  }, []);
  useEffect(() => {
    load().catch(() =>
      toast.error('Servicebereiche konnten nicht geladen werden.'),
    );
  }, [load]);
  function openArea(area?: ServiceAreaItem) {
    setEditing(area?.id ?? '');
    setAreaForm({
      code: area?.code ?? '',
      name: area?.name ?? '',
      color: area?.color ?? '#ff5a0a',
      active: area?.active ?? true,
    });
  }
  async function saveArea(event: FormEvent) {
    event.preventDefault();
    const isNew = editing === '';
    setSaving(true);
    try {
      await apiRequest(
        isNew ? '/service-areas' : `/service-areas/${editing as string}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          body: JSON.stringify(areaForm),
        },
      );
      await load();
      setEditing(null);
      toast.success('Servicebereich wurde gespeichert.');
    } catch {
      toast.error('Servicebereich konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }
  async function savePostalCode(event: FormEvent) {
    event.preventDefault();
    if (!postalArea) return;
    setSaving(true);
    try {
      await apiRequest(`/service-areas/${postalArea}/postal-codes`, {
        method: 'POST',
        body: JSON.stringify(postalForm),
      });
      await load();
      setPostalArea(null);
      toast.success('Postleitzahl wurde zugeordnet.');
    } catch {
      toast.error('Postleitzahl konnte nicht zugeordnet werden.');
    } finally {
      setSaving(false);
    }
  }
  async function deletePostalCode(areaId: string, postalCodeId: string) {
    try {
      await apiRequest(
        `/service-areas/${areaId}/postal-codes/${postalCodeId}`,
        {
          method: 'DELETE',
        },
      );
      await load();
    } catch {
      toast.error('Postleitzahl konnte nicht entfernt werden.');
    }
  }
  return (
    <div className="min-w-[1000px] px-6 py-6">
      <PageHeader
        title="SERVICEBEREICHE"
        description="Gebiete und zugeordnete Postleitzahlen"
        action={
          <button
            onClick={() => openArea()}
            className="flex h-11 items-center gap-2 rounded-lg bg-[#061b31] px-5 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> Neuer Bereich
          </button>
        }
      />
      <div className="grid grid-cols-3 gap-4">
        {items.map((area) => (
          <section key={area.id} className="rounded-xl border bg-white">
            <header className="flex items-center justify-between border-b p-4">
              <div>
                <div className="font-bold">{area.name}</div>
                <div className="text-xs text-slate-500">{area.code}</div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="size-4 rounded-full"
                  style={{ backgroundColor: area.color || '#ff5a0a' }}
                />
                <button
                  onClick={() => openArea(area)}
                  className="rounded-lg border p-2"
                  aria-label={`${area.name} bearbeiten`}
                >
                  <Pencil className="size-4" />
                </button>
              </div>
            </header>
            <div className="max-h-72 overflow-y-auto p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  {area.postal_codes_count} Postleitzahlen
                </span>
                <button
                  onClick={() => {
                    setPostalArea(area.id);
                    setPostalForm({
                      postal_code: '',
                      city: '',
                      dialing_code: '',
                    });
                  }}
                  className="text-xs font-semibold text-blue-600"
                >
                  + PLZ
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {area.postal_codes.map((postalCode) => (
                  <div
                    key={postalCode.id}
                    className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <strong>{postalCode.postal_code}</strong>
                      <div className="truncate text-xs text-slate-500">
                        {postalCode.city || '—'}
                      </div>
                    </div>
                    <button
                      onClick={() => deletePostalCode(area.id, postalCode.id)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`${postalCode.postal_code} entfernen`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
        {!items.length && (
          <div className="col-span-3 rounded-xl border bg-white p-14 text-center text-slate-500">
            Keine Servicebereiche importiert.
          </div>
        )}
      </div>
      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6">
          <form
            onSubmit={saveArea}
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
          >
            <header className="border-b p-5 text-lg font-bold">
              {editing === ''
                ? 'Neuer Servicebereich'
                : 'Servicebereich bearbeiten'}
            </header>
            <div className="grid grid-cols-2 gap-4 p-5">
              <label className="text-sm font-medium">
                Code
                <input
                  required
                  value={areaForm.code}
                  onChange={(event) =>
                    setAreaForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border px-3"
                />
              </label>
              <label className="text-sm font-medium">
                Name
                <input
                  required
                  value={areaForm.name}
                  onChange={(event) =>
                    setAreaForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border px-3"
                />
              </label>
              <label className="text-sm font-medium">
                Farbe
                <input
                  type="color"
                  value={areaForm.color}
                  onChange={(event) =>
                    setAreaForm((current) => ({
                      ...current,
                      color: event.target.value,
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border p-1"
                />
              </label>
              <label className="flex items-center gap-2 self-end pb-3 text-sm">
                <input
                  type="checkbox"
                  checked={areaForm.active}
                  onChange={(event) =>
                    setAreaForm((current) => ({
                      ...current,
                      active: event.target.checked,
                    }))
                  }
                />
                Aktiv
              </label>
            </div>
            <footer className="flex justify-end gap-3 border-t p-5">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-11 rounded-lg border px-5"
              >
                Abbrechen
              </button>
              <button
                disabled={saving}
                className="h-11 rounded-lg bg-[#ff5a0a] px-6 font-semibold text-white"
              >
                Speichern
              </button>
            </footer>
          </form>
        </div>
      )}
      {postalArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6">
          <form
            onSubmit={savePostalCode}
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
          >
            <header className="border-b p-5 text-lg font-bold">
              Postleitzahl zuordnen
            </header>
            <div className="grid grid-cols-2 gap-4 p-5">
              {[
                ['postal_code', 'PLZ', true],
                ['city', 'Ort', false],
                ['dialing_code', 'Vorwahl', false],
              ].map(([field, label, required]) => (
                <label key={field as string} className="text-sm font-medium">
                  {label as string}
                  <input
                    required={required as boolean}
                    value={postalForm[field as keyof typeof postalForm]}
                    onChange={(event) =>
                      setPostalForm((current) => ({
                        ...current,
                        [field as string]: event.target.value,
                      }))
                    }
                    className="mt-1 h-11 w-full rounded-lg border px-3"
                  />
                </label>
              ))}
            </div>
            <footer className="flex justify-end gap-3 border-t p-5">
              <button
                type="button"
                onClick={() => setPostalArea(null)}
                className="h-11 rounded-lg border px-5"
              >
                Abbrechen
              </button>
              <button
                disabled={saving}
                className="h-11 rounded-lg bg-[#ff5a0a] px-6 font-semibold text-white"
              >
                Hinzufügen
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

type DocumentsData = {
  customer: Array<{
    id: string;
    name: string;
    type: string;
    mime_type: string | null;
    size: number | null;
    created_at: string;
    customer: {
      first_name: string | null;
      last_name: string;
      company_name: string | null;
    } | null;
  }>;
  service: Array<{
    id: string;
    type: string;
    disk: string;
    path: string;
    created_at: string;
    original_name: string;
    visit: {
      id: string;
      service_order: {
        order_number: string;
        customer: { first_name: string | null; last_name: string };
      };
      technician: { name: string } | null;
    };
  }>;
};

export function DocumentsPage() {
  useOfficeAccess();
  const [data, setData] = useState<DocumentsData>({
    customer: [],
    service: [],
  });
  const [tab, setTab] = useState<'customer' | 'service'>('customer');
  useEffect(() => {
    apiRequest<{ data: DocumentsData }>('/documents')
      .then((result) => setData(result.data))
      .catch(() => toast.error('Dokumente konnten nicht geladen werden.'));
  }, []);
  return (
    <div className="min-w-[1000px] px-6 py-6">
      <PageHeader
        title="DOKUMENTE"
        description="Kunden- und Einsatzdokumente"
      />
      <div className="mb-4 flex gap-6 border-b">
        <button
          onClick={() => setTab('customer')}
          className={`border-b-2 pb-3 text-sm ${
            tab === 'customer'
              ? 'border-[#ff5a0a] font-semibold text-[#ff5a0a]'
              : 'border-transparent text-slate-500'
          }`}
        >
          Kundendokumente ({data.customer.length})
        </button>
        <button
          onClick={() => setTab('service')}
          className={`border-b-2 pb-3 text-sm ${
            tab === 'service'
              ? 'border-[#ff5a0a] font-semibold text-[#ff5a0a]'
              : 'border-transparent text-slate-500'
          }`}
        >
          Serviceberichte ({data.service.length})
        </button>
      </div>
      <section className="overflow-hidden rounded-xl border bg-white">
        {tab === 'customer' ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Dokument</th>
                <th className="px-4 py-3">Typ</th>
                <th className="px-4 py-3">Datum</th>
                <th className="w-14 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.customer.map((document) => (
                <tr key={document.id} className="border-t">
                  <td className="px-4 py-4">
                    {document.customer?.company_name ||
                      [
                        document.customer?.first_name,
                        document.customer?.last_name,
                      ]
                        .filter(Boolean)
                        .join(' ') ||
                      '—'}
                  </td>
                  <td className="px-4 py-4 font-semibold">
                    {document.name}
                  </td>
                  <td className="px-4 py-4">{document.type}</td>
                  <td className="px-4 py-4">
                    {new Date(document.created_at).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() =>
                        apiDownload(
                          `/documents/customer/${document.id}`,
                          document.name,
                        ).catch(() =>
                          toast.error('Dokument konnte nicht geladen werden.'),
                        )
                      }
                      className="rounded-lg border p-2 hover:bg-slate-50"
                    >
                      <FileDown className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="divide-y">
            {data.service.map((document) => (
              <button
                key={document.id}
                onClick={() =>
                  apiDownload(
                    `/documents/service/${document.id}`,
                    document.original_name,
                  ).catch(() =>
                    toast.error('Dokument konnte nicht geladen werden.'),
                  )
                }
                className="flex w-full items-center gap-4 p-4 text-left text-sm hover:bg-slate-50"
              >
                <FileText className="size-6 text-red-500" />
                <div className="flex-1">
                  <div className="font-semibold">
                    {document.visit.service_order.order_number} ·{' '}
                    {document.type}
                  </div>
                  <div className="text-xs text-slate-500">
                    {document.visit.service_order.customer.last_name} ·{' '}
                    {document.visit.technician?.name || '—'} ·{' '}
                    {new Date(document.created_at).toLocaleString('de-DE')}
                  </div>
                </div>
                <FileDown className="size-5 text-slate-400" />
              </button>
            ))}
          </div>
        )}
        {((tab === 'customer' && data.customer.length === 0) ||
          (tab === 'service' && data.service.length === 0)) && (
          <div className="p-14 text-center text-sm text-slate-500">
            Noch keine Dokumente vorhanden.
          </div>
        )}
      </section>
    </div>
  );
}

export function ReportsPage() {
  const data = useAnalytics();
  function exportCsv() {
    if (!data) return;
    const rows = [
      ['Kennzahl', 'Wert'],
      ...Object.entries(data.summary).map(([key, value]) => [
        key,
        String(value),
      ]),
      [],
      ['Status', 'Anzahl'],
      ...Object.entries(data.status_counts).map(([key, value]) => [
        statusNames[key] ?? key,
        String(value),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell ?? ''}"`).join(';'))
      .join('\n');
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `einsatzwerk-bericht-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="min-w-[1000px] px-6 py-6">
      <PageHeader
        title="BERICHTE"
        description="Aktuelle Betriebskennzahlen exportieren und drucken"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="h-11 rounded-lg border bg-white px-5 text-sm font-semibold"
            >
              Drucken
            </button>
            <button
              onClick={exportCsv}
              className="flex h-11 items-center gap-2 rounded-lg bg-[#061b31] px-5 text-sm font-semibold text-white"
            >
              <FileDown className="size-4" /> CSV exportieren
            </button>
          </div>
        }
      />
      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-xl font-bold">Betriebsbericht</h2>
        <div className="mt-6 grid grid-cols-4 gap-4">
          {Object.entries(data?.summary ?? {}).map(([key, value]) => (
            <div key={key} className="rounded-lg border p-4">
              <div className="text-xs text-slate-500">{key}</div>
              <strong className="mt-2 block text-2xl">{value}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type MessageItem = {
  id: string;
  subject: string;
  body: string;
  read_at: string | null;
  acknowledged_at: string | null;
  delivered_at: string | null;
  severity: 'normal' | 'high' | 'urgent';
  requires_ack: boolean;
  type: string;
  created_at: string;
  sender: { id: string; name: string };
  recipient: { id: string; name: string } | null;
  service_order: { id: string; order_number: string } | null;
  visit: { id: string } | null;
  attachments: Array<{
    id: string;
    original_name: string;
    size: number;
  }>;
};

export function MessagesPage() {
  const router = useOfficeAccess();
  const [items, setItems] = useState<MessageItem[]>([]);
  const [technicians, setTechnicians] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [orders, setOrders] = useState<
    Array<{ id: string; order_number: string }>
  >([]);
  const [compose, setCompose] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [form, setForm] = useState({
    recipient_id: '',
    service_order_id: '',
    subject: '',
    body: '',
    severity: 'normal',
    requires_ack: false,
  });
  const load = useCallback(async () => {
    const result = await apiRequest<{ data: MessageItem[] }>('/messages');
    setItems(result.data);
  }, []);
  useEffect(() => {
    load().catch(() =>
      toast.error('Nachrichten konnten nicht geladen werden.'),
    );
    apiRequest<{ data: Array<{ id: string; name: string }> }>('/technicians')
      .then((result) => setTechnicians(result.data))
      .catch(() => null);
    apiRequest<{
      data: Array<{ id: string; order_number: string }>;
    }>('/service-orders?per_page=100')
      .then((result) => setOrders(result.data))
      .catch(() => null);
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function send(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await apiRequest<{ data: { id: string } }>('/messages', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          recipient_id: form.recipient_id || null,
          service_order_id: form.service_order_id || null,
          requires_ack: form.requires_ack && Boolean(form.recipient_id),
        }),
      });
      if (attachment) {
        const upload = new FormData();
        upload.append('file', attachment);
        await apiRequest(`/messages/${result.data.id}/attachments`, {
          method: 'POST',
          body: upload,
        });
      }
      setForm({
        recipient_id: '',
        service_order_id: '',
        subject: '',
        body: '',
        severity: 'normal',
        requires_ack: false,
      });
      setCompose(false);
      setAttachment(null);
      toast.success('Nachricht wurde gesendet.');
      await load();
    } catch {
      toast.error('Nachricht konnte nicht gesendet werden.');
    }
  }
  async function markRead(message: MessageItem) {
    if (message.read_at || !message.recipient) return;
    await apiRequest(`/messages/${message.id}/read`, {
      method: 'PATCH',
    }).catch(() => null);
    setItems((current) =>
      current.map((item) =>
        item.id === message.id
          ? { ...item, read_at: new Date().toISOString() }
          : item,
      ),
    );
  }
  return (
    <div className="min-w-[1000px] px-6 py-6">
      <PageHeader
        title="NACHRICHTEN"
        description="Interne Kommunikation mit dem Außendienst"
        action={
          <button
            onClick={() => setCompose(true)}
            className="flex h-11 items-center gap-2 rounded-lg bg-[#ff5a0a] px-5 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> Neue Nachricht
          </button>
        }
      />
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="divide-y">
          {items.map((message) => (
            <article
              key={message.id}
              onClick={() => void markRead(message)}
              className={`flex cursor-pointer gap-4 p-5 ${
                !message.read_at && message.recipient
                  ? 'bg-orange-50/50'
                  : 'bg-white'
              }`}
            >
              <MessageSquare
                className={`mt-1 size-5 ${
                  message.severity === 'urgent'
                    ? 'text-red-600'
                    : message.severity === 'high'
                      ? 'text-orange-600'
                      : 'text-blue-600'
                }`}
              />
              <div className="flex-1">
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <strong>{message.subject}</strong>
                    {message.type === 'system' && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 uppercase">
                        System
                      </span>
                    )}
                    {message.requires_ack && (
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                        Bestätigung erforderlich
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(message.created_at).toLocaleString('de-DE')}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {message.sender.name} → {message.recipient?.name || 'Alle'}
                  {message.service_order &&
                    ` · ${message.service_order.order_number}`}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  {message.body}
                </p>
                {message.service_order && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(
                        `/office/orders?order=${message.service_order?.id}`,
                      );
                    }}
                    className="mt-3 text-xs font-semibold text-blue-600"
                  >
                    Auftrag öffnen
                  </button>
                )}
                {message.attachments?.map((attachment) => (
                  <button
                    key={attachment.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void apiDownload(
                        `/messages/${message.id}/attachments/${attachment.id}`,
                        attachment.original_name,
                      );
                    }}
                    className="mt-3 mr-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
                  >
                    <Paperclip className="size-3.5" />
                    {attachment.original_name}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {!items.length && (
            <div className="p-14 text-center text-sm text-slate-500">
              Noch keine Nachrichten.
            </div>
          )}
        </div>
      </section>
      {compose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6">
          <form
            onSubmit={send}
            className="w-full max-w-xl rounded-2xl bg-white"
          >
            <header className="border-b p-5 text-lg font-bold">
              Neue Nachricht
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-medium">
                Empfänger
                <select
                  value={form.recipient_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      recipient_id: event.target.value,
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border bg-white px-3"
                >
                  <option value="">Alle Mitarbeiter</option>
                  {technicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Auftrag (optional)
                <select
                  value={form.service_order_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      service_order_id: event.target.value,
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border bg-white px-3"
                >
                  <option value="">Ohne Auftragsbezug</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.order_number}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-medium">
                  Dringlichkeit
                  <select
                    value={form.severity}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        severity: event.target.value,
                      }))
                    }
                    className="mt-1 h-11 w-full rounded-lg border bg-white px-3"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">Wichtig</option>
                    <option value="urgent">Dringend</option>
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.requires_ack}
                    disabled={!form.recipient_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        requires_ack: event.target.checked,
                      }))
                    }
                  />
                  Bestätigung verlangen
                </label>
              </div>
              <label className="block text-sm font-medium">
                Betreff
                <input
                  required
                  value={form.subject}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-lg border px-3"
                />
              </label>
              <label className="block text-sm font-medium">
                Nachricht
                <textarea
                  required
                  value={form.body}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  className="mt-1 min-h-36 w-full rounded-lg border p-3"
                />
              </label>
              <label className="block text-sm font-medium">
                Anhang (optional)
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={(event) =>
                    setAttachment(event.target.files?.[0] ?? null)
                  }
                  className="mt-1 block w-full rounded-lg border p-2 text-sm"
                />
              </label>
            </div>
            <footer className="flex justify-end gap-3 border-t p-5">
              <button
                type="button"
                onClick={() => setCompose(false)}
                className="h-11 rounded-lg border px-5"
              >
                Abbrechen
              </button>
              <button className="flex h-11 items-center gap-2 rounded-lg bg-[#ff5a0a] px-5 font-semibold text-white">
                <Send className="size-4" /> Senden
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

type OrganizationSettings = {
  name: string;
  legal_name: string | null;
  timezone: string;
  locale: string;
  currency: string;
  settings: Record<string, unknown> | null;
};

type TelephonyIntegration = {
  id: string;
  provider: '3cx' | 'placetel' | 'generic';
  name: string;
  enabled: boolean;
  calls_count: number;
  last_event_at: string | null;
};

type TelephonyCredentials = {
  key: string;
  contact_lookup_url: string;
  event_webhook_url: string;
  placetel_subscription: Record<string, unknown> | null;
};

export function SettingsPage() {
  useOfficeAccess();
  const [form, setForm] = useState<OrganizationSettings | null>(null);
  const [telephony, setTelephony] = useState<TelephonyIntegration[]>([]);
  const [credentials, setCredentials] = useState<TelephonyCredentials | null>(
    null,
  );
  const [creatingProvider, setCreatingProvider] = useState<string | null>(null);
  const [testNumber, setTestNumber] = useState('');
  const [testingIntegration, setTestingIntegration] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default');
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    Promise.all([
      apiRequest<{ data: OrganizationSettings }>('/settings'),
      apiRequest<{ data: TelephonyIntegration[] }>('/telephony/integrations'),
    ])
      .then(([settingsResult, telephonyResult]) => {
        setForm(settingsResult.data);
        setTelephony(telephonyResult.data);
      })
      .catch(() => toast.error('Einstellungen konnten nicht geladen werden.'));
  }, []);

  async function createTelephonyIntegration(
    provider: TelephonyIntegration['provider'],
  ) {
    setCreatingProvider(provider);
    try {
      const result = await apiRequest<{
        data: TelephonyIntegration;
        credentials: TelephonyCredentials;
      }>('/telephony/integrations', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          name:
            provider === '3cx'
              ? '3CX Telefonanlage'
              : provider === 'placetel'
                ? 'Placetel'
                : 'Weitere Telefonanlage',
        }),
      });
      setTelephony((current) => [...current, result.data]);
      setCredentials(result.credentials);
      toast.success('Telefonie-Anbindung wurde angelegt.');
    } catch {
      toast.error('Telefonie-Anbindung konnte nicht angelegt werden.');
    } finally {
      setCreatingProvider(null);
    }
  }

  async function toggleTelephonyIntegration(integration: TelephonyIntegration) {
    try {
      const result = await apiRequest<{ data: TelephonyIntegration }>(
        `/telephony/integrations/${integration.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !integration.enabled }),
        },
      );
      setTelephony((current) =>
        current.map((item) =>
          item.id === integration.id ? result.data : item,
        ),
      );
    } catch {
      toast.error('Telefonie-Anbindung konnte nicht geändert werden.');
    }
  }

  async function simulateCall(integration: TelephonyIntegration) {
    if (!testNumber.trim()) {
      toast.error('Bitte eine Test-Rufnummer eingeben.');
      return;
    }
    setTestingIntegration(integration.id);
    try {
      await apiRequest('/telephony/simulate', {
        method: 'POST',
        body: JSON.stringify({
          integration_id: integration.id,
          event: 'IncomingCall',
          from: testNumber.trim(),
          to: 'Zentrale',
          caller_name: 'Testanruf',
        }),
      });
      toast.success('Testanruf wurde an den Arbeitsplatz gesendet.');
    } catch {
      toast.error('Testanruf konnte nicht ausgelöst werden.');
    } finally {
      setTestingIntegration(null);
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success('In die Zwischenablage kopiert.');
  }
  async function enableBrowserNotifications() {
    if (!('Notification' in window)) {
      toast.error('Dieser Browser unterstützt keine Systembenachrichtigungen.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      toast.success('Systembenachrichtigungen sind aktiviert.');
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const result = await apiRequest<{ data: OrganizationSettings }>(
        '/settings',
        {
          method: 'PATCH',
          body: JSON.stringify(form),
        },
      );
      setForm(result.data);
      toast.success('Einstellungen wurden gespeichert.');
    } catch {
      toast.error('Einstellungen konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="max-w-5xl px-6 py-6">
      <PageHeader
        title="EINSTELLUNGEN"
        description="Betrieb, Sprache und regionale Vorgaben"
      />
      {form && (
        <form onSubmit={save} className="rounded-xl border bg-white">
          <header className="flex items-center gap-3 border-b p-5 font-bold">
            <Settings className="size-5 text-[#ff5a0a]" /> Betrieb
          </header>
          <div className="grid grid-cols-2 gap-5 p-6">
            {[
              ['name', 'Anzeigename'],
              ['legal_name', 'Rechtlicher Name'],
              ['timezone', 'Zeitzone'],
              ['currency', 'Währung'],
            ].map(([field, label]) => (
              <label key={field} className="text-sm font-medium">
                {label}
                <input
                  required={field !== 'legal_name'}
                  value={String(
                    form[field as keyof OrganizationSettings] ?? '',
                  )}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? { ...current, [field]: event.target.value || null }
                        : current,
                    )
                  }
                  className="mt-1 h-11 w-full rounded-lg border px-3"
                />
              </label>
            ))}
            <label className="text-sm font-medium">
              Sprache
              <select
                value={form.locale}
                onChange={(event) =>
                  setForm((current) =>
                    current
                      ? { ...current, locale: event.target.value }
                      : current,
                  )
                }
                className="mt-1 h-11 w-full rounded-lg border bg-white px-3"
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <footer className="flex justify-end border-t p-5">
            <button
              disabled={saving}
              className="h-11 rounded-lg bg-[#ff5a0a] px-6 font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Speichern…' : 'Änderungen speichern'}
            </button>
          </footer>
        </form>
      )}

      <section className="mt-6 rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between gap-6">
          <div>
            <div className="font-bold">Akustische Arbeitsplatzmeldungen</div>
            <div className="mt-1 text-sm text-slate-500">
              Systemmeldung und Ton bei Anrufen und wichtigen
              Außendienstmeldungen.
            </div>
          </div>
          <button
            type="button"
            disabled={notificationPermission === 'granted'}
            onClick={() => void enableBrowserNotifications()}
            className="h-11 rounded-lg bg-[#061b31] px-5 text-sm font-semibold text-white disabled:bg-emerald-600"
          >
            {notificationPermission === 'granted'
              ? 'Aktiviert'
              : notificationPermission === 'denied'
                ? 'Im Browser blockiert'
                : 'Aktivieren'}
          </button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border bg-white">
        <header className="flex items-start justify-between border-b p-5">
          <div className="flex gap-3">
            <Phone className="mt-0.5 size-5 text-[#ff5a0a]" />
            <div>
              <div className="font-bold">Telefonie & Screen Pop</div>
              <div className="mt-1 text-sm text-slate-500">
                Eingehende Anrufe erkennen und Kundendaten automatisch öffnen
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {(['3cx', 'placetel'] as const).map((provider) => (
              <button
                key={provider}
                disabled={creatingProvider !== null}
                onClick={() => void createTelephonyIntegration(provider)}
                className="flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus className="size-4" />
                {provider === '3cx' ? '3CX' : 'Placetel'} verbinden
              </button>
            ))}
          </div>
        </header>

        <div className="p-5">
          {telephony.length > 0 && (
            <div className="mb-5 flex gap-3">
              <input
                value={testNumber}
                onChange={(event) => setTestNumber(event.target.value)}
                placeholder="Rufnummer für Testanruf"
                className="h-10 flex-1 rounded-lg border px-3 text-sm"
              />
            </div>
          )}

          <div className="space-y-3">
            {telephony.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between rounded-xl border p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{integration.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        integration.enabled
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {integration.enabled ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {integration.calls_count} Anrufe
                    {integration.last_event_at
                      ? ` · Letztes Ereignis ${new Date(
                          integration.last_event_at,
                        ).toLocaleString('de-DE')}`
                      : ' · Noch kein Ereignis empfangen'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={
                      !integration.enabled ||
                      testingIntegration === integration.id
                    }
                    onClick={() => void simulateCall(integration)}
                    className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    Testanruf
                  </button>
                  <button
                    onClick={() => void toggleTelephonyIntegration(integration)}
                    className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50"
                  >
                    {integration.enabled ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                </div>
              </div>
            ))}
            {telephony.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
                Noch keine Telefonanlage verbunden.
              </div>
            )}
          </div>
        </div>
      </section>

      {credentials && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#061b31]/55 p-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold">
              Zugangsdaten der Telefonanlage
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Diese geheimen URLs werden nur jetzt vollständig angezeigt.
            </p>
            <div className="mt-6 space-y-4">
              {[
                ['Kontaktsuche (3CX)', credentials.contact_lookup_url],
                ['Ereignis-Webhook', credentials.event_webhook_url],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mb-1 text-xs font-semibold text-slate-500">
                    {label}
                  </div>
                  <div className="flex gap-2">
                    <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs">
                      {value}
                    </code>
                    <button
                      onClick={() => void copyValue(value)}
                      title="Kopieren"
                      className="rounded-lg border px-3 hover:bg-slate-50"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              {credentials.placetel_subscription && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-500">
                    Placetel Subscription Body
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs">
                    {JSON.stringify(credentials.placetel_subscription, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setCredentials(null)}
                className="h-11 rounded-lg bg-[#ff5a0a] px-6 font-semibold text-white"
              >
                Zugangsdaten gespeichert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
