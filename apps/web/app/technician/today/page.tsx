'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  LocateFixed,
  Navigation,
  Phone,
  Route,
} from 'lucide-react';
import { apiRequest, getAccessToken } from '@/lib/einsatzwerk-api';

type Visit = {
  id: string;
  status: string;
  planned_start_at: string | null;
  planned_end_at: string | null;
  order: {
    order_number: string;
    priority: string;
    fault_description: string;
  };
  customer: {
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
    model: string | null;
    serial_number: string | null;
  } | null;
};

const colors = [
  'bg-orange-500',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-violet-500',
  'bg-amber-500',
  'bg-cyan-600',
];

function time(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function address(visit: Visit): string {
  return [
    visit.location.street,
    visit.location.house_number,
    visit.location.postal_code,
    visit.location.city,
  ]
    .filter(Boolean)
    .join(' ');
}

export default function TechnicianTodayPage() {
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const selected = useMemo(
    () => visits.find((visit) => visit.id === selectedId) ?? visits[0],
    [selectedId, visits],
  );

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    apiRequest<{ data: Visit[] }>('/technician/today')
      .then((result) => {
        setVisits(result.data);
        setSelectedId(result.data[0]?.id ?? '');
      })
      .catch((error: Error & { status?: number }) => {
        if (error.status === 401 || error.status === 403) {
          router.replace('/login');
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="mx-auto max-w-[1500px] p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <h1 className="text-2xl font-bold">Meine Einsätze</h1>
        <div className="flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm">
          <CalendarDays className="size-4" /> Heute
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-10 text-center">
          Einsätze werden geladen…
        </div>
      ) : visits.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center">
          <CalendarDays className="mx-auto mb-4 size-10 text-emerald-600" />
          <h2 className="text-xl font-bold">Heute keine Einsätze</h2>
          <p className="mt-2 text-slate-500">
            Neue Zuweisungen erscheinen automatisch hier.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[335px_1fr_340px]">
          <div className="space-y-4">
            {selected && (
              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    Nächster Einsatz
                  </span>
                  <span className="font-semibold text-[#ff5a0a]">
                    Heute {time(selected.planned_start_at)}
                  </span>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {selected.customer.name}
                    </div>
                    <div className="mt-2 text-slate-600">
                      {address(selected)}
                    </div>
                    <span className="mt-3 inline-block rounded-md bg-orange-100 px-3 py-1 text-sm">
                      {selected.order.priority}
                    </span>
                  </div>
                  {selected.customer.primary_phone && (
                    <a
                      href={`tel:${selected.customer.primary_phone}`}
                      className="flex size-12 items-center justify-center rounded-full border"
                    >
                      <Phone className="size-6" />
                    </a>
                  )}
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address(selected))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#ff5a0a] font-semibold text-white"
                >
                  <Navigation className="size-5" /> Navigation starten
                </a>
              </section>
            )}

            <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <span className="text-sm font-semibold text-slate-500 uppercase">
                  Meine Tour
                </span>
                <span className="font-semibold">{visits.length} Einsätze</span>
              </div>
              {visits.map((visit, index) => (
                <button
                  key={visit.id}
                  onClick={() => setSelectedId(visit.id)}
                  className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left last:border-0 ${
                    selected?.id === visit.id ? 'bg-orange-50' : ''
                  }`}
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-full font-bold text-white ${colors[index % colors.length]}`}
                  >
                    {index + 1}
                  </span>
                  <span className="w-12 font-semibold">
                    {time(visit.planned_start_at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {visit.customer.name}
                    </span>
                    <span className="block text-sm text-slate-500">
                      {visit.location.city}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-slate-400" />
                </button>
              ))}
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex h-[440px] min-h-[330px] flex-col bg-[linear-gradient(135deg,#e7f1e7_25%,#f5f1df_25%,#f5f1df_50%,#e9f2ea_50%,#e9f2ea_75%,#f4f0df_75%)] bg-[length:90px_90px] lg:h-full">
              <div className="flex items-center justify-between bg-white/92 px-5 py-4">
                <span className="text-sm font-semibold text-slate-500 uppercase">
                  Route & Karte
                </span>
                <LocateFixed className="size-5" />
              </div>
              <div className="relative flex-1">
                <svg
                  className="absolute inset-0 size-full"
                  viewBox="0 0 600 600"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M300 70 C 250 150, 410 190, 350 260 S 170 330, 260 420 S 400 470, 220 550"
                    fill="none"
                    stroke="#1473e6"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                </svg>
                {visits.map((visit, index) => (
                  <span
                    key={visit.id}
                    className={`absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white font-bold text-white shadow ${colors[index % colors.length]}`}
                    style={{
                      left: `${35 + ((index * 17) % 35)}%`,
                      top: `${12 + index * (75 / Math.max(visits.length - 1, 1))}%`,
                    }}
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-3 border-t bg-white">
                {[
                  ['Tour', `${visits.length} Stopps`, Route],
                  ['Beginn', time(visits[0]?.planned_start_at ?? null), Clock3],
                  [
                    'Ende',
                    time(visits.at(-1)?.planned_end_at ?? null),
                    CalendarDays,
                  ],
                ].map(([label, value, Icon]) => (
                  <div
                    key={label as string}
                    className="flex flex-col items-center border-r p-4 last:border-0"
                  >
                    <Icon className="mb-1 size-5 text-blue-600" />
                    <span className="text-xs text-slate-500 uppercase">
                      {label as string}
                    </span>
                    <strong className="mt-1 text-lg">{value as string}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {selected && (
            <section className="hidden space-y-4 xl:block">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Aktueller Auftrag
                </div>
                <h2 className="mt-5 text-xl font-bold">
                  {selected.customer.name}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {address(selected)}
                </p>
                <div className="mt-5 border-t pt-5">
                  <div className="text-xs font-semibold text-slate-500">
                    PROBLEM
                  </div>
                  <p className="mt-2 text-sm">
                    {selected.order.fault_description}
                  </p>
                </div>
              </div>
              <Link
                href={`/technician/visits/${selected.id}`}
                className="flex h-14 items-center justify-center gap-3 rounded-xl bg-[#ff5a0a] font-semibold text-white"
              >
                Einsatz öffnen <ArrowRight className="size-5" />
              </Link>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
