'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  History,
  Mail,
  MapPin,
  Phone,
  Plus,
  Printer,
  Search,
  UserRound,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, getAccessToken } from '@/lib/einsatzwerk-api';

type Customer = {
  id: string;
  customer_number: string;
  display_name: string;
  primary_phone: string | null;
  location: {
    id: string;
    street: string | null;
    house_number: string | null;
    postal_code: string | null;
    city: string | null;
  } | null;
};

const emptyCustomer: Customer = {
  id: '',
  customer_number: '',
  display_name: 'Kunde auswählen',
  primary_phone: null,
  location: null,
};

const assets = [
  {
    id: 1,
    name: 'Bosch Waschmaschine',
    model: 'WAE282ECO',
    details: 'FD: 9204   SN: 123456789',
    active: true,
    emoji: '🧺',
  },
  {
    id: 2,
    name: 'Siemens Kühlschrank',
    model: 'KG36NXI30',
    details: 'FD: 1007   SN: 987654321',
    active: true,
    emoji: '🧊',
  },
  {
    id: 3,
    name: 'Miele Geschirrspüler',
    model: 'G 6200 SCi',
    details: 'FD: 1103   SN: 456789123',
    active: false,
    emoji: '🍽️',
  },
];

const steps = [
  'Kunde finden',
  'Gerät wählen',
  'Problem erfassen',
  'Termin & Details',
  'Bestätigen',
];

function Panel({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,35,60,0.03)] ${className}`}
    >
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function CallIntakePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [assetId, setAssetId] = useState(1);
  const [priority, setPriority] = useState('high');
  const [faultDescription, setFaultDescription] = useState(
    'Maschine pumpt nicht ab, Wasser bleibt in der Trommel. Fehler tritt seit gestern Abend auf.',
  );
  const [saving, setSaving] = useState(false);
  const selectedCustomer =
    customers.find((customer) => customer.id === customerId) ??
    customers[0] ??
    emptyCustomer;

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const result = await apiRequest<{ data: Customer[] }>(
          `/customers/search?q=${encodeURIComponent(query)}`,
        );
        setCustomers(result.data);
        setCustomerId((current) =>
          result.data.some((customer) => customer.id === current)
            ? current
            : (result.data[0]?.id ?? ''),
        );
      } catch (exception) {
        const status = (exception as Error & { status?: number }).status;
        if (status === 401) router.replace('/login');
        else toast.error('Kundensuche konnte nicht geladen werden.');
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, router]);

  async function createOrder() {
    if (!selectedCustomer.id || !selectedCustomer.location?.id) {
      toast.error('Bitte einen Kunden mit Serviceadresse auswählen.');
      return;
    }

    setSaving(true);
    try {
      const result = await apiRequest<{
        data: { order_number: string };
      }>('/service-orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          service_location_id: selectedCustomer.location.id,
          priority,
          fault_description: faultDescription,
        }),
      });
      toast.success(`Auftrag ${result.data.order_number} wurde angelegt.`);
    } catch {
      toast.error('Der Auftrag konnte nicht angelegt werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-[1180px] px-7 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">1. ANRUFANNAHME</h1>
        <p className="mt-1 text-sm text-slate-500">
          Neuen Auftrag schnell erfassen
        </p>
      </div>

      <div className="mb-6 flex items-center">
        {steps.map((step, index) => (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`flex size-6 items-center justify-center rounded-full border text-xs font-semibold ${
                  index === 0
                    ? 'border-[#ff5a0a] bg-[#ff5a0a] text-white'
                    : 'border-slate-300 bg-white text-slate-500'
                }`}
              >
                {index + 1}
              </span>
              <span
                className={index === 0 ? 'font-semibold' : 'text-slate-500'}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="mx-5 h-px flex-1 bg-slate-200" />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[300px_1fr_390px] gap-4">
        <Panel title="Kunde suchen" className="row-span-2">
          <div className="relative mb-3">
            <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm outline-none focus:border-[#ff5a0a] focus:bg-white"
              placeholder="Name, Telefon, Kundennummer…"
            />
          </div>
          <div className="mb-2 text-[11px] font-semibold text-slate-500 uppercase">
            Letzte Kunden
          </div>
          <div className="space-y-1">
            {customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => setCustomerId(customer.id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                  customer.id === customerId
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="font-semibold">{customer.display_name}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{customer.primary_phone || '—'}</span>
                  <span>{customer.location?.city || '—'}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="flex h-10 items-center justify-center gap-2 rounded-lg border text-sm hover:bg-slate-50">
              <Plus className="size-4" /> Neuer Kunde
            </button>
            <button className="flex h-10 items-center justify-center gap-2 rounded-lg border text-sm hover:bg-slate-50">
              <UserRound className="size-4" /> Öffnen
            </button>
          </div>
        </Panel>

        <Panel title="Kundendaten">
          <div className="grid grid-cols-[220px_1fr] gap-5">
            <div>
              <div className="mb-4">
                <div className="text-xs text-slate-500">Name</div>
                <div className="mt-1 font-semibold">
                  {selectedCustomer.display_name}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Kundennummer {selectedCustomer.customer_number}
                </div>
              </div>
              <div className="space-y-2">
                <button className="flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm">
                  {selectedCustomer.primary_phone || '—'}
                  <Phone className="size-4 text-slate-500" />
                </button>
                <button className="flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm">
                  0172 3456789
                  <Phone className="size-4 text-slate-500" />
                </button>
                <button className="flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm">
                  p.mueller@email.de
                  <Mail className="size-4 text-slate-500" />
                </button>
              </div>
              <div className="mt-4 flex gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-500" />
                <span>
                  {[
                    selectedCustomer.location?.street,
                    selectedCustomer.location?.house_number,
                  ]
                    .filter(Boolean)
                    .join(' ') || '—'}
                  <br />
                  {[
                    selectedCustomer.location?.postal_code,
                    selectedCustomer.location?.city,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </span>
              </div>
            </div>

            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b px-3 py-2.5">
                <span className="text-sm font-semibold">
                  Geräte beim Kunden
                </span>
                <button className="text-xs font-semibold text-blue-600">
                  + Gerät hinzufügen
                </button>
              </div>
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setAssetId(asset.id)}
                  className={`flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-0 ${
                    assetId === asset.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex size-11 items-center justify-center rounded-lg bg-slate-100 text-xl">
                    {asset.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{asset.name}</div>
                    <div className="text-xs text-slate-500">{asset.model}</div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {asset.details}
                    </div>
                  </div>
                  <span
                    className={`rounded px-2 py-1 text-[11px] ${
                      asset.active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {asset.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                  <ChevronRight className="size-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Anrufinformationen">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Eingang</dt>
                <dd>17.07.2026&nbsp;&nbsp;09:15</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Anrufer</dt>
                <dd>Peter Müller</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Telefonnummer</dt>
                <dd>{selectedCustomer.primary_phone || '—'}</dd>
              </div>
            </dl>
            <textarea
              className="mt-4 min-h-20 w-full rounded-lg border p-3 text-sm outline-none focus:border-[#ff5a0a]"
              placeholder="Rückrufbitte, besondere Hinweise…"
            />
          </Panel>

          <Panel title="Letzte Notizen">
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <FileText className="mt-0.5 size-4 text-slate-400" />
                <div>
                  <div className="text-xs text-slate-500">
                    15.05.2026 · Sabine Becker
                  </div>
                  <p className="mt-1">Waschmaschine pumpt manchmal nicht ab.</p>
                </div>
              </div>
              <div className="flex gap-3 border-t pt-3">
                <History className="mt-0.5 size-4 text-slate-400" />
                <div>
                  <div className="text-xs text-slate-500">
                    03.02.2026 · Thomas Becker
                  </div>
                  <p className="mt-1">Kühlschrank kühlt oben zu wenig.</p>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Problem erfassen (kurz)" className="col-span-2">
          <div className="grid grid-cols-[330px_230px_1fr] gap-7">
            <div>
              <label className="mb-1 block text-xs font-medium">
                Problemkategorie
              </label>
              <select className="h-10 w-full rounded-lg border bg-white px-3 text-sm">
                <option>Waschmaschine – Wasser / Ablauf</option>
                <option>Waschmaschine – Elektrik</option>
                <option>Kühlgerät – Temperatur</option>
              </select>
              <label className="mt-3 mb-1 block text-xs font-medium">
                Beschreibung
              </label>
              <textarea
                value={faultDescription}
                onChange={(event) => setFaultDescription(event.target.value)}
                className="min-h-20 w-full rounded-lg border p-3 text-sm outline-none focus:border-[#ff5a0a]"
              />
            </div>

            <div>
              <div className="mb-2 text-xs font-medium">Priorität</div>
              {[
                ['low', 'Niedrig'],
                ['normal', 'Mittel'],
                ['high', 'Hoch'],
                ['urgent', 'Dringend'],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="mb-2 flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="priority"
                    checked={priority === value}
                    onChange={() => setPriority(value)}
                    className="accent-[#ff5a0a]"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">
                Sonstige Hinweise
              </label>
              <textarea
                className="min-h-28 w-full rounded-lg border p-3 text-sm outline-none focus:border-[#ff5a0a]"
                placeholder="Besondere Umstände, Zugang, Parken…"
              />
              <div className="mt-3 flex gap-2">
                <button className="flex h-10 items-center gap-2 rounded-lg border px-4 text-sm">
                  <Phone className="size-4" /> Rückruf vereinbaren
                </button>
                <button className="flex h-10 items-center gap-2 rounded-lg border px-4 text-sm">
                  <CalendarDays className="size-4" /> Terminwunsch
                </button>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Aktionen">
          <div className="space-y-1">
            {[
              [Printer, 'Kundenkarte drucken'],
              [History, 'Historie anzeigen'],
              [FileText, 'Alle Dokumente'],
            ].map(([Icon, label]) => (
              <button
                key={label as string}
                className="flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-slate-50"
              >
                <Icon className="size-4 text-slate-500" />
                {label as string}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border bg-white p-3">
        <div className="flex gap-7 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <Clock3 className="size-4" /> Eingang 09:15
          </span>
          <span className="flex items-center gap-2">
            <Wrench className="size-4" /> Gerät gewählt
          </span>
        </div>
        <button
          onClick={createOrder}
          disabled={saving || !selectedCustomer.id}
          className="flex h-12 min-w-56 items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-[#ff5a0a] to-[#ff6d00] px-6 font-semibold text-white shadow-lg shadow-orange-200 disabled:opacity-50"
        >
          {saving ? 'Auftrag wird angelegt…' : 'Auftrag anlegen'}
          <Check className="size-5" />
        </button>
      </div>
    </div>
  );
}
