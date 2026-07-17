'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  FileText,
  Mail,
  MapPin,
  PackageOpen,
  Pencil,
  Phone,
  Plus,
  Search,
  Star,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, getAccessToken } from '@/lib/einsatzwerk-api';

type Location = {
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
};

type CustomerListItem = {
  id: string;
  customer_number: string;
  legacy_customer_number: string | null;
  first_name: string | null;
  last_name: string;
  company_name: string | null;
  primary_phone: string | null;
  status: string;
  service_locations: Location[];
  assets_count: number;
  service_orders_count: number;
};

type Asset = {
  id: string;
  model: string | null;
  serial_number: string | null;
  production_number: string | null;
  purchase_date: string | null;
  status: string;
  manufacturer: { id: string; name: string } | null;
};

type ServiceOrder = {
  id: string;
  order_number: string;
  fault_description: string;
  status: string;
  created_at: string;
  asset: { id: string; model: string | null; serial_number: string | null } | null;
};

type CommercialDocument = {
  id: string;
  document_number: string;
  legacy_document_number: string;
  type: string;
  document_date: string | null;
};

type CustomerDetail = CustomerListItem & {
  secondary_phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  assets: Asset[];
  service_orders: ServiceOrder[];
  commercial_documents: CommercialDocument[];
};

function displayName(customer: Pick<CustomerListItem, 'company_name' | 'first_name' | 'last_name'>) {
  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(' ')
  );
}

function address(location?: Location) {
  if (!location) return 'Keine Adresse';
  return [
    [location.street, location.house_number].filter(Boolean).join(' '),
    [location.postal_code, location.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
}

const orderStatus: Record<string, string> = {
  new: 'Neu',
  awaiting_scheduling: 'Zu planen',
  planned: 'Geplant',
  in_progress: 'In Arbeit',
  awaiting_parts: 'Warten auf Teile',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestedCustomerId, setRequestedCustomerId] = useState('');
  const [requestedView, setRequestedView] = useState('');

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    setRequestedCustomerId(parameters.get('customer') ?? '');
    setRequestedView(parameters.get('view') ?? '');
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<{ data: CustomerListItem[] }>(
        `/customers?limit=100${
          query.trim()
            ? `&q=${encodeURIComponent(query.trim())}`
            : requestedCustomerId
              ? `&id=${encodeURIComponent(requestedCustomerId)}`
              : ''
        }`,
      );
      setCustomers(result.data);
      setSelectedId((current) =>
        result.data.some((customer) => customer.id === current)
          ? current
          : result.data.some((customer) => customer.id === requestedCustomerId)
            ? requestedCustomerId
          : (result.data[0]?.id ?? ''),
      );
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      if (status === 401 || status === 403) router.replace('/login');
      else toast.error('Kunden konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [query, requestedCustomerId, router]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    const timer = window.setTimeout(loadCustomers, 250);
    return () => window.clearTimeout(timer);
  }, [loadCustomers, router]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    apiRequest<{ data: CustomerDetail }>(`/customers/${selectedId}`)
      .then((result) => setDetail(result.data))
      .catch(() => toast.error('Kundendetails konnten nicht geladen werden.'));
  }, [selectedId]);

  useEffect(() => {
    if (!detail || !requestedView) return;
    document
      .getElementById(
        requestedView === 'documents' ? 'customer-documents' : 'customer-history',
      )
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [detail, requestedView]);

  const primaryLocation = useMemo(
    () =>
      detail?.service_locations.find((location) => location.is_primary) ??
      detail?.service_locations[0],
    [detail],
  );

  return (
    <div className="min-w-[1200px] px-6 py-5">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">STAMMDATEN</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kunden, Serviceadressen, Geräte und Historie
          </p>
        </div>
        <button
          onClick={() => router.push('/office/call-intake')}
          className="flex h-11 items-center gap-2 rounded-lg bg-[#061b31] px-5 text-sm font-semibold text-white"
        >
          <Plus className="size-5" /> Neu hinzufügen
        </button>
      </div>

      <div className="mb-4 flex gap-7 border-b">
        {['Kunden', 'Geräte', 'Techniker', 'Servicebereiche', 'Lager & Teile'].map(
          (tab, index) => (
            <button
              key={tab}
              className={`border-b-2 px-1 pb-3 text-sm ${
                index === 0
                  ? 'border-[#ff5a0a] font-semibold text-[#ff5a0a]'
                  : 'border-transparent text-slate-500'
              }`}
            >
              {tab}
            </button>
          ),
        )}
      </div>

      <div className="grid grid-cols-[300px_1fr_350px] gap-4">
        <section className="overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-4">
            <h2 className="mb-3 font-bold">Kunden ({customers.length})</h2>
            <div className="relative">
              <Search className="absolute top-3 left-3 size-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
                placeholder="Kunden suchen…"
              />
            </div>
          </div>
          <div className="max-h-[730px] overflow-y-auto">
            {customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => setSelectedId(customer.id)}
                className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left ${
                  selectedId === customer.id
                    ? 'border-l-2 border-l-[#ff5a0a] bg-orange-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                  {(customer.first_name?.[0] ?? customer.company_name?.[0] ?? '') +
                    customer.last_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {displayName(customer)}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {customer.customer_number} · {customer.primary_phone || '—'}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {address(customer.service_locations[0])}
                  </div>
                </div>
                <Star className="size-4 text-slate-300" />
              </button>
            ))}
            {!loading && customers.length === 0 && (
              <div className="p-10 text-center text-sm text-slate-500">
                Keine Kunden gefunden.
              </div>
            )}
          </div>
        </section>

        <div className="space-y-4">
          {detail ? (
            <>
              <section className="rounded-xl border bg-white p-5">
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-full bg-orange-100 font-bold text-[#ff5a0a]">
                      {detail.first_name?.[0] ?? detail.last_name[0]}
                      {detail.last_name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold">{displayName(detail)}</h2>
                        <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                          Aktiv
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Kundennummer {detail.customer_number}
                        {detail.legacy_customer_number
                          ? ` · Legacy ${detail.legacy_customer_number}`
                          : ''}
                      </div>
                    </div>
                  </div>
                  <button className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                    <Pencil className="size-4" /> Bearbeiten
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 border-t pt-4 text-sm">
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 text-slate-400" />
                    <span>{detail.primary_phone || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 text-slate-400" />
                    <span>{detail.secondary_phone || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="size-4 text-slate-400" />
                    <span>{detail.email || '—'}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 text-slate-400" />
                    <span>{address(primaryLocation)}</span>
                  </div>
                </div>
                {detail.notes && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    {detail.notes}
                  </div>
                )}
              </section>

              <section
                id="customer-history"
                className="scroll-mt-24 rounded-xl border bg-white"
              >
                <div className="flex items-center justify-between border-b p-4">
                  <h3 className="font-bold">Serviceadressen ({detail.service_locations.length})</h3>
                  <button className="text-sm font-semibold text-blue-600">+ Adresse hinzufügen</button>
                </div>
                <div className="grid grid-cols-2 divide-x">
                  {detail.service_locations.slice(0, 2).map((location, index) => (
                    <div key={location.id} className="p-4 text-sm">
                      <div className="mb-2 flex items-center gap-2 font-semibold">
                        <span className="flex size-5 items-center justify-center rounded-full bg-orange-100 text-xs text-[#ff5a0a]">
                          {index + 1}
                        </span>
                        {location.name || (location.is_primary ? 'Hauptadresse' : 'Serviceadresse')}
                      </div>
                      <div>{[location.street, location.house_number].filter(Boolean).join(' ')}</div>
                      <div>{[location.postal_code, location.city].filter(Boolean).join(' ')}</div>
                      {location.access_notes && (
                        <div className="mt-3 text-xs text-slate-500">Zugang: {location.access_notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border bg-white">
                <div className="border-b p-4 font-bold">Letzte Aufträge</div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Auftrag</th>
                      <th className="px-4 py-3">Datum</th>
                      <th className="px-4 py-3">Gerät / Problem</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.service_orders.map((order) => (
                      <tr key={order.id} className="border-t">
                        <td className="px-4 py-3 font-semibold text-blue-600">
                          {order.order_number}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(order.created_at).toLocaleDateString('de-DE')}
                        </td>
                        <td className="max-w-64 px-4 py-3">
                          <div className="font-medium">{order.asset?.model || 'Ohne Gerät'}</div>
                          <div className="truncate text-xs text-slate-500">{order.fault_description}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                            {orderStatus[order.status] || order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detail.service_orders.length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-500">Noch keine Aufträge.</div>
                )}
              </section>
            </>
          ) : (
            <div className="rounded-xl border bg-white p-16 text-center text-slate-500">
              <UserRound className="mx-auto mb-3 size-8" />
              Kunde auswählen
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <section
            id="customer-documents"
            className="scroll-mt-24 rounded-xl border bg-white"
          >
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="font-bold">Geräte beim Kunden ({detail?.assets.length ?? 0})</h3>
              <button className="text-sm font-semibold text-blue-600">+ Gerät</button>
            </div>
            {detail?.assets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-3 border-b p-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <PackageOpen className="size-6 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-semibold">
                    {[asset.manufacturer?.name, asset.model].filter(Boolean).join(' ') || 'Gerät'}
                  </div>
                  <div className="text-xs text-slate-500">SN: {asset.serial_number || '—'}</div>
                  <div className="text-xs text-slate-500">FD: {asset.production_number || '—'}</div>
                </div>
                <span className={`rounded px-2 py-1 text-xs ${
                  asset.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {asset.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                </span>
                <ChevronRight className="size-4 text-slate-400" />
              </div>
            ))}
            {!detail?.assets.length && (
              <div className="p-8 text-center text-sm text-slate-500">Keine Geräte erfasst.</div>
            )}
          </section>

          <section className="rounded-xl border bg-white">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="font-bold">Dokumente</h3>
              <button className="text-sm font-semibold text-blue-600">+ Dokument</button>
            </div>
            {detail?.commercial_documents.map((document) => (
              <div key={document.id} className="flex items-center gap-3 border-b p-4 text-sm">
                <FileText className="size-5 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{document.document_number}</div>
                  <div className="text-xs text-slate-500">
                    {document.type} ·{' '}
                    {document.document_date
                      ? new Date(document.document_date).toLocaleDateString('de-DE')
                      : 'ohne Datum'}
                  </div>
                </div>
              </div>
            ))}
            {!detail?.commercial_documents.length && (
              <div className="p-8 text-center text-sm text-slate-500">
                Keine Dokumente vorhanden.
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
