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
import {
  apiDownload,
  apiRequest,
  getAccessToken,
} from '@/lib/einsatzwerk-api';

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
  installation_date?: string | null;
  warranty_until?: string | null;
  notes?: string | null;
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

type CustomerDocument = {
  id: string;
  name: string;
  type: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
};

type CustomerDetail = CustomerListItem & {
  secondary_phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  assets: Asset[];
  service_orders: ServiceOrder[];
  commercial_documents: CommercialDocument[];
  documents: CustomerDocument[];
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
  const [editor, setEditor] = useState<'customer' | 'location' | 'asset' | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    primary_phone: '',
    secondary_phone: '',
    email: '',
    notes: '',
    status: 'active',
  });
  const [locationForm, setLocationForm] = useState({
    name: '',
    contact_person: '',
    street: '',
    house_number: '',
    address_addition: '',
    postal_code: '',
    city: '',
    access_notes: '',
    parking_notes: '',
    is_primary: false,
  });
  const [assetForm, setAssetForm] = useState({
    id: '',
    model: '',
    serial_number: '',
    production_number: '',
    purchase_date: '',
    installation_date: '',
    warranty_until: '',
    notes: '',
    status: 'active',
  });

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

  async function refreshDetail() {
    if (!selectedId) return;
    const result = await apiRequest<{ data: CustomerDetail }>(
      `/customers/${selectedId}`,
    );
    setDetail(result.data);
  }

  function openCustomerEditor() {
    if (!detail) return;
    setCustomerForm({
      first_name: detail.first_name || '',
      last_name: detail.last_name || '',
      company_name: detail.company_name || '',
      primary_phone: detail.primary_phone || '',
      secondary_phone: detail.secondary_phone || '',
      email: detail.email || '',
      notes: detail.notes || '',
      status: detail.status || 'active',
    });
    setEditor('customer');
  }

  function openAssetEditor(asset?: Asset) {
    setAssetForm({
      id: asset?.id || '',
      model: asset?.model || '',
      serial_number: asset?.serial_number || '',
      production_number: asset?.production_number || '',
      purchase_date: asset?.purchase_date?.slice(0, 10) || '',
      installation_date: asset?.installation_date?.slice(0, 10) || '',
      warranty_until: asset?.warranty_until?.slice(0, 10) || '',
      notes: asset?.notes || '',
      status: asset?.status || 'active',
    });
    setEditor('asset');
  }

  async function saveCustomer(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    try {
      await apiRequest(`/customers/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify(customerForm),
      });
      await Promise.all([refreshDetail(), loadCustomers()]);
      setEditor(null);
      toast.success('Kundendaten wurden gespeichert.');
    } catch {
      toast.error('Kundendaten konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function saveLocation(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    try {
      await apiRequest(`/customers/${selectedId}/locations`, {
        method: 'POST',
        body: JSON.stringify(locationForm),
      });
      await refreshDetail();
      setEditor(null);
      toast.success('Serviceadresse wurde hinzugefügt.');
    } catch {
      toast.error('Serviceadresse konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAsset(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    try {
      const { id, ...payload } = assetForm;
      await apiRequest(
        id
          ? `/customers/${selectedId}/assets/${id}`
          : `/customers/${selectedId}/assets`,
        {
          method: id ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      await refreshDetail();
      setEditor(null);
      toast.success(id ? 'Gerät wurde aktualisiert.' : 'Gerät wurde hinzugefügt.');
    } catch {
      toast.error('Gerät konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(file?: File) {
    if (!selectedId || !file) return;
    setUploadingDocument(true);
    try {
      const body = new FormData();
      body.append('file', file);
      await apiRequest(`/customers/${selectedId}/documents`, {
        method: 'POST',
        body,
      });
      await refreshDetail();
      toast.success('Dokument wurde hochgeladen.');
    } catch {
      toast.error('Dokument konnte nicht hochgeladen werden.');
    } finally {
      setUploadingDocument(false);
    }
  }

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
                  <button
                    onClick={openCustomerEditor}
                    className="flex items-center gap-2 text-sm font-semibold text-blue-600"
                  >
                    <Pencil className="size-4" /> Bearbeiten
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 border-t pt-4 text-sm">
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 text-slate-400" />
                    {detail.primary_phone ? (
                      <a href={`tel:${detail.primary_phone}`}>{detail.primary_phone}</a>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 text-slate-400" />
                    <span>{detail.secondary_phone || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="size-4 text-slate-400" />
                    {detail.email ? (
                      <a href={`mailto:${detail.email}`}>{detail.email}</a>
                    ) : (
                      <span>—</span>
                    )}
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
                  <button
                    onClick={() => {
                      setLocationForm({
                        name: '',
                        contact_person: '',
                        street: '',
                        house_number: '',
                        address_addition: '',
                        postal_code: '',
                        city: '',
                        access_notes: '',
                        parking_notes: '',
                        is_primary: detail.service_locations.length === 0,
                      });
                      setEditor('location');
                    }}
                    className="text-sm font-semibold text-blue-600"
                  >
                    + Adresse hinzufügen
                  </button>
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
              <button
                onClick={() => openAssetEditor()}
                className="text-sm font-semibold text-blue-600"
              >
                + Gerät
              </button>
            </div>
            {detail?.assets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => openAssetEditor(asset)}
                className="flex w-full items-center gap-3 border-b p-4 text-left hover:bg-slate-50"
              >
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
              </button>
            ))}
            {!detail?.assets.length && (
              <div className="p-8 text-center text-sm text-slate-500">Keine Geräte erfasst.</div>
            )}
          </section>

          <section className="rounded-xl border bg-white">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="font-bold">Dokumente</h3>
              <label className="cursor-pointer text-sm font-semibold text-blue-600">
                {uploadingDocument ? 'Wird hochgeladen…' : '+ Dokument'}
                <input
                  type="file"
                  disabled={uploadingDocument}
                  onChange={(event) => {
                    void uploadDocument(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
            </div>
            {detail?.documents.map((document) => (
              <button
                key={document.id}
                onClick={() =>
                  apiDownload(
                    `/customers/${detail.id}/documents/${document.id}`,
                    document.name,
                  ).catch(() =>
                    toast.error('Dokument konnte nicht geladen werden.'),
                  )
                }
                className="flex w-full items-center gap-3 border-b p-4 text-left text-sm hover:bg-slate-50"
              >
                <FileText className="size-5 shrink-0 text-blue-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{document.name}</div>
                  <div className="text-xs text-slate-500">
                    {document.type} ·{' '}
                    {new Date(document.created_at).toLocaleDateString('de-DE')}
                  </div>
                </div>
              </button>
            ))}
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
            {!detail?.commercial_documents.length && !detail?.documents.length && (
              <div className="p-8 text-center text-sm text-slate-500">
                Keine Dokumente vorhanden.
              </div>
            )}
          </section>
        </aside>
      </div>

      {editor === 'customer' && (
        <EditorModal title="Kunde bearbeiten" onClose={() => setEditor(null)}>
          <form onSubmit={saveCustomer}>
            <div className="grid grid-cols-2 gap-4 p-6">
              {[
                ['first_name', 'Vorname', false],
                ['last_name', 'Nachname', true],
                ['company_name', 'Firma', false],
                ['primary_phone', 'Telefon', false],
                ['secondary_phone', 'Mobil / Telefon 2', false],
                ['email', 'E-Mail', false],
              ].map(([field, label, required]) => (
                <label key={field as string} className="text-sm font-medium">
                  {label as string}
                  <input
                    required={required as boolean}
                    type={field === 'email' ? 'email' : 'text'}
                    value={
                      customerForm[field as keyof typeof customerForm] as string
                    }
                    onChange={(event) =>
                      setCustomerForm((current) => ({
                        ...current,
                        [field as string]: event.target.value,
                      }))
                    }
                    className="mt-1 h-11 w-full rounded-lg border px-3"
                  />
                </label>
              ))}
              <label className="col-span-2 text-sm font-medium">
                Notizen
                <textarea
                  value={customerForm.notes}
                  onChange={(event) =>
                    setCustomerForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="mt-1 min-h-28 w-full rounded-lg border p-3"
                />
              </label>
              <label className="text-sm font-medium">
                Status
                <select
                  value={customerForm.status}
                  onChange={(event) =>
                    setCustomerForm((current) => ({
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
            </div>
            <EditorFooter saving={saving} onCancel={() => setEditor(null)} />
          </form>
        </EditorModal>
      )}

      {editor === 'location' && (
        <EditorModal title="Serviceadresse hinzufügen" onClose={() => setEditor(null)}>
          <form onSubmit={saveLocation}>
            <div className="grid grid-cols-2 gap-4 p-6">
              {[
                ['name', 'Bezeichnung', false],
                ['contact_person', 'Kontaktperson', false],
                ['street', 'Straße', false],
                ['house_number', 'Hausnummer', false],
                ['postal_code', 'PLZ', true],
                ['city', 'Ort', true],
                ['access_notes', 'Zugangshinweise', false],
                ['parking_notes', 'Parkhinweise', false],
              ].map(([field, label, required]) => (
                <label key={field as string} className="text-sm font-medium">
                  {label as string}
                  <input
                    required={required as boolean}
                    value={
                      locationForm[field as keyof typeof locationForm] as string
                    }
                    onChange={(event) =>
                      setLocationForm((current) => ({
                        ...current,
                        [field as string]: event.target.value,
                      }))
                    }
                    className="mt-1 h-11 w-full rounded-lg border px-3"
                  />
                </label>
              ))}
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={locationForm.is_primary}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      is_primary: event.target.checked,
                    }))
                  }
                />
                Als Hauptadresse verwenden
              </label>
            </div>
            <EditorFooter saving={saving} onCancel={() => setEditor(null)} />
          </form>
        </EditorModal>
      )}

      {editor === 'asset' && (
        <EditorModal
          title={assetForm.id ? 'Gerät bearbeiten' : 'Gerät hinzufügen'}
          onClose={() => setEditor(null)}
        >
          <form onSubmit={saveAsset}>
            <div className="grid grid-cols-2 gap-4 p-6">
              {[
                ['model', 'Modell / Bezeichnung', true, 'text'],
                ['serial_number', 'Seriennummer', false, 'text'],
                ['production_number', 'FD / Produktionsnummer', false, 'text'],
                ['purchase_date', 'Kaufdatum', false, 'date'],
                ['installation_date', 'Installationsdatum', false, 'date'],
                ['warranty_until', 'Garantie bis', false, 'date'],
              ].map(([field, label, required, type]) => (
                <label key={field as string} className="text-sm font-medium">
                  {label as string}
                  <input
                    required={required as boolean}
                    type={type as string}
                    value={assetForm[field as keyof typeof assetForm] as string}
                    onChange={(event) =>
                      setAssetForm((current) => ({
                        ...current,
                        [field as string]: event.target.value,
                      }))
                    }
                    className="mt-1 h-11 w-full rounded-lg border px-3"
                  />
                </label>
              ))}
              <label className="col-span-2 text-sm font-medium">
                Notizen
                <textarea
                  value={assetForm.notes}
                  onChange={(event) =>
                    setAssetForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="mt-1 min-h-24 w-full rounded-lg border p-3"
                />
              </label>
              <label className="text-sm font-medium">
                Status
                <select
                  value={assetForm.status}
                  onChange={(event) =>
                    setAssetForm((current) => ({
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
            </div>
            <EditorFooter saving={saving} onCancel={() => setEditor(null)} />
          </form>
        </EditorModal>
      )}
    </div>
  );
}

function EditorModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">
            Schließen
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function EditorFooter({
  saving,
  onCancel,
}: {
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <footer className="flex justify-end gap-3 border-t px-6 py-4">
      <button
        type="button"
        onClick={onCancel}
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
  );
}
