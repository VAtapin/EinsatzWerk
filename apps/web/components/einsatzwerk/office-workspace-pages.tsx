'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Boxes,
  CheckCircle2,
  FileDown,
  FileText,
  MapPin,
  MessageSquare,
  PackageOpen,
  Plus,
  Search,
  Send,
  Settings,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, getAccessToken } from '@/lib/einsatzwerk-api';

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
              <div key={point.day} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold">{point.total}</span>
                <div
                  className="w-full rounded-t bg-blue-500"
                  style={{ height: `${Math.max(8, (point.total / maximum) * 190)}px` }}
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
              <div className="m-auto text-sm text-slate-500">Noch keine Aufträge.</div>
            )}
          </div>
        </section>
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Aufträge nach Status</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(data?.status_counts ?? {}).map(([status, total]) => (
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
            ))}
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
                <td className="px-4 py-4 font-semibold">
                  {[asset.manufacturer?.name, asset.model].filter(Boolean).join(' ') ||
                    'Gerät'}
                </td>
                <td className="px-4 py-4 text-slate-600">
                  <div>SN: {asset.serial_number || '—'}</div>
                  <div className="text-xs">FD: {asset.production_number || '—'}</div>
                </td>
                <td className="px-4 py-4">
                  {asset.customer.company_name ||
                    [asset.customer.first_name, asset.customer.last_name]
                      .filter(Boolean)
                      .join(' ')}
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
  const router = useOfficeAccess();
  const [items, setItems] = useState<TechnicianItem[]>([]);
  useEffect(() => {
    apiRequest<{ data: TechnicianItem[] }>('/technicians/workspace')
      .then((result) => setItems(result.data))
      .catch(() => toast.error('Techniker konnten nicht geladen werden.'));
  }, []);

  return (
    <div className="min-w-[1080px] px-6 py-6">
      <PageHeader
        title="7. TECHNIKER"
        description="Techniker verwalten und Einsätze überwachen"
        action={
          <button
            onClick={() => router.push('/office/planning')}
            className="h-11 rounded-lg bg-[#061b31] px-5 text-sm font-semibold text-white"
          >
            Planung öffnen
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
            </tr>
          </thead>
          <tbody>
            {items.map((technician) => (
              <tr key={technician.id} className="border-t align-top">
                <td className="px-4 py-4">
                  <div className="font-semibold">{technician.name}</div>
                  <div className="text-xs text-slate-500">{technician.email}</div>
                  <div className="text-xs text-slate-500">{technician.phone || '—'}</div>
                </td>
                <td className="px-4 py-4">
                  <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                    {technician.status === 'active' ? 'Aktiv' : technician.status}
                  </span>
                </td>
                <td className="px-4 py-4 font-semibold">{technician.visits_today}</td>
                <td className="px-4 py-4">
                  {technician.visits_open} / {technician.visits_total}
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    {technician.assigned_visits.map((visit) => (
                      <div key={visit.id} className="rounded bg-slate-50 px-3 py-2 text-xs">
                        {new Date(visit.planned_start_at).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {visit.service_order.order_number} ·{' '}
                        {visit.service_order.customer.last_name}
                      </div>
                    ))}
                    {!technician.assigned_visits.length && (
                      <span className="text-slate-400">Keine Einsätze heute</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
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
  useEffect(() => {
    apiRequest<{ data: ServiceAreaItem[] }>('/service-areas')
      .then((result) => setItems(result.data))
      .catch(() => toast.error('Servicebereiche konnten nicht geladen werden.'));
  }, []);
  return (
    <div className="min-w-[1000px] px-6 py-6">
      <PageHeader
        title="SERVICEBEREICHE"
        description="Gebiete und zugeordnete Postleitzahlen"
      />
      <div className="grid grid-cols-3 gap-4">
        {items.map((area) => (
          <section key={area.id} className="rounded-xl border bg-white">
            <header className="flex items-center justify-between border-b p-4">
              <div>
                <div className="font-bold">{area.name}</div>
                <div className="text-xs text-slate-500">{area.code}</div>
              </div>
              <span
                className="size-4 rounded-full"
                style={{ backgroundColor: area.color || '#ff5a0a' }}
              />
            </header>
            <div className="max-h-72 overflow-y-auto p-4">
              <div className="mb-3 text-xs font-semibold text-slate-500 uppercase">
                {area.postal_codes_count} Postleitzahlen
              </div>
              <div className="grid grid-cols-2 gap-2">
                {area.postal_codes.map((postalCode) => (
                  <div key={postalCode.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                    <strong>{postalCode.postal_code}</strong>
                    <div className="truncate text-xs text-slate-500">
                      {postalCode.city || '—'}
                    </div>
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
    </div>
  );
}

type DocumentsData = {
  commercial: Array<{
    id: string;
    document_number: string;
    type: string;
    document_date: string | null;
    lines_count: number;
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
    commercial: [],
    service: [],
  });
  const [tab, setTab] = useState<'commercial' | 'service'>('commercial');
  useEffect(() => {
    apiRequest<{ data: DocumentsData }>('/documents')
      .then((result) => setData(result.data))
      .catch(() => toast.error('Dokumente konnten nicht geladen werden.'));
  }, []);
  return (
    <div className="min-w-[1000px] px-6 py-6">
      <PageHeader title="DOKUMENTE" description="Kunden- und Einsatzdokumente" />
      <div className="mb-4 flex gap-6 border-b">
        <button
          onClick={() => setTab('commercial')}
          className={`border-b-2 pb-3 text-sm ${
            tab === 'commercial'
              ? 'border-[#ff5a0a] font-semibold text-[#ff5a0a]'
              : 'border-transparent text-slate-500'
          }`}
        >
          Kundendokumente ({data.commercial.length})
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
        {tab === 'commercial' ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">Dokument</th>
                <th className="px-4 py-3">Typ</th>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Positionen</th>
              </tr>
            </thead>
            <tbody>
              {data.commercial.map((document) => (
                <tr key={document.id} className="border-t">
                  <td className="px-4 py-4 font-semibold text-blue-600">
                    {document.document_number}
                  </td>
                  <td className="px-4 py-4">{document.type}</td>
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
                  <td className="px-4 py-4">
                    {document.document_date
                      ? new Date(document.document_date).toLocaleDateString('de-DE')
                      : '—'}
                  </td>
                  <td className="px-4 py-4">{document.lines_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="divide-y">
            {data.service.map((document) => (
              <div key={document.id} className="flex items-center gap-4 p-4 text-sm">
                <FileText className="size-6 text-red-500" />
                <div className="flex-1">
                  <div className="font-semibold">
                    {document.visit.service_order.order_number} · {document.type}
                  </div>
                  <div className="text-xs text-slate-500">
                    {document.visit.service_order.customer.last_name} ·{' '}
                    {document.visit.technician?.name || '—'} ·{' '}
                    {new Date(document.created_at).toLocaleString('de-DE')}
                  </div>
                </div>
              </div>
            ))}
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
      ...Object.entries(data.summary).map(([key, value]) => [key, String(value)]),
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
  created_at: string;
  sender: { id: string; name: string };
  recipient: { id: string; name: string } | null;
};

export function MessagesPage() {
  useOfficeAccess();
  const [items, setItems] = useState<MessageItem[]>([]);
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [compose, setCompose] = useState(false);
  const [form, setForm] = useState({ recipient_id: '', subject: '', body: '' });
  const load = useCallback(async () => {
    const result = await apiRequest<{ data: MessageItem[] }>('/messages');
    setItems(result.data);
  }, []);
  useEffect(() => {
    load().catch(() => toast.error('Nachrichten konnten nicht geladen werden.'));
    apiRequest<{ data: Array<{ id: string; name: string }> }>('/technicians')
      .then((result) => setTechnicians(result.data))
      .catch(() => null);
  }, [load]);
  async function send(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest('/messages', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          recipient_id: form.recipient_id || null,
        }),
      });
      setForm({ recipient_id: '', subject: '', body: '' });
      setCompose(false);
      toast.success('Nachricht wurde gesendet.');
      await load();
    } catch {
      toast.error('Nachricht konnte nicht gesendet werden.');
    }
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
            <article key={message.id} className="flex gap-4 p-5">
              <MessageSquare className="mt-1 size-5 text-blue-600" />
              <div className="flex-1">
                <div className="flex justify-between">
                  <strong>{message.subject}</strong>
                  <span className="text-xs text-slate-500">
                    {new Date(message.created_at).toLocaleString('de-DE')}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {message.sender.name} → {message.recipient?.name || 'Alle'}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  {message.body}
                </p>
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
          <form onSubmit={send} className="w-full max-w-xl rounded-2xl bg-white">
            <header className="border-b p-5 text-lg font-bold">Neue Nachricht</header>
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
                Betreff
                <input
                  required
                  value={form.subject}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subject: event.target.value }))
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
                    setForm((current) => ({ ...current, body: event.target.value }))
                  }
                  className="mt-1 min-h-36 w-full rounded-lg border p-3"
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

export function SettingsPage() {
  useOfficeAccess();
  const [form, setForm] = useState<OrganizationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    apiRequest<{ data: OrganizationSettings }>('/settings')
      .then((result) => setForm(result.data))
      .catch(() => toast.error('Einstellungen konnten nicht geladen werden.'));
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const result = await apiRequest<{ data: OrganizationSettings }>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
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
                  value={String(form[field as keyof OrganizationSettings] ?? '')}
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
                    current ? { ...current, locale: event.target.value } : current,
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
    </div>
  );
}
