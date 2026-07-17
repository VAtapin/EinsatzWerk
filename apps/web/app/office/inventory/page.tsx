'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronRight,
  Clock3,
  PackageCheck,
  PackageOpen,
  Search,
  ShoppingCart,
  Truck,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, getAccessToken } from '@/lib/einsatzwerk-api';

type Requirement = {
  id: string;
  description: string;
  quantity: string;
  status: string;
  supplier_reference: string | null;
  office_notes: string | null;
  created_at: string;
  requested_by: { id: string; name: string } | null;
  approved_by: { id: string; name: string } | null;
  visit: {
    id: string;
    technician: { id: string; name: string } | null;
  } | null;
  service_order: {
    id: string;
    order_number: string;
    fault_description: string;
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
  };
};

const statusTabs = [
  ['', 'Alle'],
  ['requested', 'Angefordert'],
  ['approved', 'Freigegeben'],
  ['ordered', 'Bestellt'],
  ['received', 'Eingetroffen'],
  ['rejected', 'Abgelehnt'],
] as const;

const statusLabel: Record<string, string> = {
  requested: 'Angefordert',
  approved: 'Freigegeben',
  ordered: 'Bestellt',
  received: 'Eingetroffen',
  rejected: 'Abgelehnt',
};

const statusStyle: Record<string, string> = {
  requested: 'bg-orange-100 text-orange-700',
  approved: 'bg-blue-100 text-blue-700',
  ordered: 'bg-violet-100 text-violet-700',
  received: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

type InventoryAction = {
  status: string;
  label: string;
  icon: LucideIcon;
};

function customerName(requirement: Requirement): string {
  return (
    requirement.service_order.customer.company_name ||
    [
      requirement.service_order.customer.first_name,
      requirement.service_order.customer.last_name,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

export default function InventoryPage() {
  const router = useRouter();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [supplierReference, setSupplierReference] = useState('');
  const [officeNotes, setOfficeNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () =>
      requirements.find((requirement) => requirement.id === selectedId) ??
      requirements[0],
    [requirements, selectedId],
  );
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('de-DE');
    return requirements.filter((requirement) => {
      if (status && requirement.status !== status) return false;
      if (!normalized) return true;

      return [
        requirement.description,
        requirement.service_order.order_number,
        customerName(requirement),
        requirement.visit?.technician?.name,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase('de-DE').includes(normalized),
        );
    });
  }, [query, requirements, status]);

  const load = useCallback(async () => {
    try {
      const result = await apiRequest<{ data: Requirement[] }>(
        '/part-requirements',
      );
      setRequirements(result.data);
      setSelectedId((current) =>
        result.data.some((requirement) => requirement.id === current)
          ? current
          : (result.data[0]?.id ?? ''),
      );
    } catch (error) {
      const code = (error as Error & { status?: number }).status;
      if (code === 401 || code === 403) router.replace('/login');
      else toast.error('Teileanforderungen konnten nicht geladen werden.');
    }
  }, [router]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    load();
  }, [load, router]);

  useEffect(() => {
    setSupplierReference(selected?.supplier_reference ?? '');
    setOfficeNotes(selected?.office_notes ?? '');
  }, [selected]);

  async function transition(nextStatus: string) {
    if (!selected) return;
    setBusy(true);
    try {
      await apiRequest(`/part-requirements/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          supplier_reference: supplierReference || null,
          office_notes: officeNotes || null,
        }),
      });
      toast.success(`Status: ${statusLabel[nextStatus]}`);
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const nextActions: InventoryAction[] =
    selected?.status === 'requested'
      ? [
          { status: 'approved', label: 'Freigeben', icon: Check },
          { status: 'rejected', label: 'Ablehnen', icon: X },
        ]
      : selected?.status === 'approved'
        ? [
            {
              status: 'ordered',
              label: 'Als bestellt markieren',
              icon: ShoppingCart,
            },
            { status: 'rejected', label: 'Ablehnen', icon: X },
          ]
        : selected?.status === 'ordered'
          ? [
              {
                status: 'received',
                label: 'Wareneingang buchen',
                icon: PackageCheck,
              },
            ]
          : [];

  const metrics: Array<{
    label: string;
    value: number;
    icon: LucideIcon;
  }> = [
    {
      label: 'Offen',
      value: requirements.filter((item) => item.status === 'requested').length,
      icon: Clock3,
    },
    {
      label: 'Bestellt',
      value: requirements.filter((item) => item.status === 'ordered').length,
      icon: Truck,
    },
    {
      label: 'Eingetroffen',
      value: requirements.filter((item) => item.status === 'received').length,
      icon: PackageCheck,
    },
  ];

  return (
    <div className="min-w-[1160px] px-6 py-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            LAGER / TEILE
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ersatzteilbedarf vom Außendienst bearbeiten
          </p>
        </div>
        <div className="flex gap-3">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex min-w-36 items-center gap-3 rounded-xl border bg-white px-4 py-3">
              <Icon className="size-5 text-[#ff5a0a]" />
              <div>
                <div className="text-xs text-slate-500">{label}</div>
                <strong>{value}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 flex gap-7 border-b">
        {statusTabs.map(([value, label]) => (
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

      <div className="grid grid-cols-[1fr_390px] gap-4">
        <section className="overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-4">
            <div className="relative">
              <Search className="absolute top-3 left-3 size-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
                placeholder="Teil, Auftrag, Kunde oder Techniker suchen…"
              />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">Teil / Menge</th>
                <th className="px-4 py-3">Auftrag / Kunde</th>
                <th className="px-4 py-3">Techniker</th>
                <th className="px-4 py-3">Angefordert</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {visible.map((requirement) => (
                <tr
                  key={requirement.id}
                  onClick={() => setSelectedId(requirement.id)}
                  className={`cursor-pointer border-t ${
                    selected?.id === requirement.id
                      ? 'bg-orange-50/70'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-4 py-4">
                    <strong>{requirement.description}</strong>
                    <span className="mt-1 block text-xs text-slate-500">
                      {Number(requirement.quantity)} ×
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <strong>{requirement.service_order.order_number}</strong>
                    <span className="mt-1 block text-xs text-slate-500">
                      {customerName(requirement)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {requirement.visit?.technician?.name ?? '—'}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {new Date(requirement.created_at).toLocaleString('de-DE')}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded px-2 py-1 text-xs ${statusStyle[requirement.status]}`}>
                      {statusLabel[requirement.status]}
                    </span>
                  </td>
                  <td><ChevronRight className="size-4 text-slate-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              Keine Teileanforderungen gefunden.
            </div>
          )}
        </section>

        <aside className="h-fit overflow-hidden rounded-xl border bg-white">
          {selected ? (
            <>
              <div className="border-b p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-orange-100">
                    <PackageOpen className="size-6 text-[#ff5a0a]" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">
                      {selected.service_order.order_number}
                    </div>
                    <h2 className="text-lg font-bold">{selected.description}</h2>
                  </div>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex gap-3">
                    <UserRound className="size-4 text-slate-400" />
                    <span>{customerName(selected)}</span>
                  </div>
                  <div className="flex gap-3">
                    <Wrench className="size-4 text-slate-400" />
                    <span>{selected.visit?.technician?.name ?? '—'}</span>
                  </div>
                  <p className="rounded-lg bg-slate-50 p-3 text-slate-600">
                    {selected.service_order.fault_description}
                  </p>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <label className="block text-xs font-semibold">
                  Lieferantenreferenz
                  <input
                    value={supplierReference}
                    onChange={(event) => setSupplierReference(event.target.value)}
                    disabled={selected.status === 'received' || selected.status === 'rejected'}
                    className="mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
                    placeholder="Bestellnummer / Lieferant"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Notiz der Disposition
                  <textarea
                    value={officeNotes}
                    onChange={(event) => setOfficeNotes(event.target.value)}
                    disabled={selected.status === 'received' || selected.status === 'rejected'}
                    className="mt-1.5 min-h-24 w-full rounded-lg border p-3 text-sm"
                  />
                </label>
                {nextActions.map(({ status: nextStatus, label, icon: Icon }) => (
                  <button
                    key={nextStatus}
                    onClick={() => transition(nextStatus)}
                    disabled={busy}
                    className={`flex h-12 w-full items-center justify-center gap-2 rounded-lg font-semibold disabled:opacity-40 ${
                      nextStatus === 'rejected'
                        ? 'border border-red-200 text-red-600'
                        : 'bg-[#ff5a0a] text-white'
                    }`}
                  >
                    <Icon className="size-5" /> {label}
                  </button>
                ))}
                {selected.status === 'received' && (
                  <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
                    <PackageCheck className="mb-2 size-5" />
                    Teil eingetroffen. Der Auftrag liegt wieder in der
                    Planung für einen Folgeeinsatz.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-slate-500">
              Teileanforderung auswählen
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
