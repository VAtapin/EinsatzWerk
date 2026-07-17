'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  LocateFixed,
  Navigation,
  Phone,
  Route,
} from 'lucide-react';

const visits = [
  ['1', '10:30', 'Müller, Peter', 'Schwedt/Oder', 'Heizung', 'orange'],
  ['2', '12:15', 'Schmidt, Anna', 'Schwedt/Oder', 'Waschmaschine', 'blue'],
  ['3', '14:00', 'Weber, Thomas', 'Eberswalde', 'Kühlschrank', 'green'],
  ['4', '15:45', 'Becker, Claudia', 'Joachimsthal', 'Geschirrspüler', 'violet'],
  ['5', '17:00', 'Klein, Martin', 'Bernau', 'Heizung', 'amber'],
  ['6', '18:15', 'Richter, Sabine', 'Panketal', 'Waschmaschine', 'blue'],
] as const;

const colors: Record<string, string> = {
  orange: 'bg-orange-500',
  blue: 'bg-blue-600',
  green: 'bg-emerald-600',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
};

export default function TechnicianTodayPage() {
  const [selected, setSelected] = useState('1');

  return (
    <div className="mx-auto max-w-[1500px] p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <h1 className="text-2xl font-bold">Meine Einsätze</h1>
        <button className="flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm">
          <CalendarDays className="size-4" /> Heute
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[335px_1fr_340px]">
        <div className="space-y-4">
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Nächster Einsatz
              </span>
              <span className="font-semibold text-[#ff5a0a]">Heute 10:30</span>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-2xl font-bold">Müller, Peter</div>
                <div className="mt-2 text-slate-600">
                  Friedrichstraße 12
                  <br />
                  16303 Schwedt/Oder
                </div>
                <span className="mt-3 inline-block rounded-md bg-orange-100 px-3 py-1 text-sm">
                  Heizung
                </span>
              </div>
              <button className="flex size-12 items-center justify-center rounded-full border">
                <Phone className="size-6" />
              </button>
            </div>
            <button className="mt-5 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#ff5a0a] font-semibold text-white">
              <Navigation className="size-5" /> Navigation starten
            </button>
          </section>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <span className="text-sm font-semibold text-slate-500 uppercase">
                Meine Tour
              </span>
              <span className="font-semibold">6 Einsätze</span>
            </div>
            {visits.map(([id, time, name, city, type, color]) => (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left last:border-0 ${
                  selected === id ? 'bg-orange-50' : ''
                }`}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full font-bold text-white ${colors[color]}`}
                >
                  {id}
                </span>
                <span className="w-12 font-semibold">{time}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{name}</span>
                  <span className="block text-sm text-slate-500">{city}</span>
                </span>
                <span className="hidden rounded bg-slate-100 px-2 py-1 text-xs sm:block">
                  {type}
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
              {[
                ['1', '50%', '9%'],
                ['2', '67%', '29%'],
                ['3', '43%', '45%'],
                ['4', '31%', '66%'],
                ['5', '58%', '76%'],
                ['6', '37%', '89%'],
              ].map(([id, left, top]) => (
                <span
                  key={id}
                  className={`absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white font-bold text-white shadow ${colors[visits[Number(id) - 1][5]]}`}
                  style={{ left, top }}
                >
                  {id}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-3 border-t bg-white">
              {[
                ['Gesamtdauer', '7h 45min', Clock3],
                ['Strecke', '126 km', Route],
                ['Einsätze', '6', CalendarDays],
              ].map(([label, value, Icon]) => (
                <div
                  key={label as string}
                  className="flex flex-col items-center border-r p-4 last:border-0"
                >
                  <Icon className="mb-1 size-5 text-blue-600" />
                  <span className="text-xs text-slate-500 uppercase">
                    {label as string}
                  </span>
                  <strong className="mt-1 text-xl">{value as string}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="hidden space-y-4 xl:block">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">
              Aktueller Auftrag
            </div>
            <div className="mt-5 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">Müller, Peter</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Friedrichstraße 12
                  <br />
                  16303 Schwedt/Oder
                </p>
              </div>
              <Phone />
            </div>
            <div className="mt-5 border-t pt-5">
              <div className="text-xs font-semibold text-slate-500">
                PROBLEM
              </div>
              <p className="mt-2 text-sm">
                Heizung wird nicht warm, Heizkörper bleiben kalt.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">
              Gerät
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <strong>Vaillant ecoTEC plus</strong>
                <div className="mt-1 text-sm text-slate-500">
                  SN: 21087465123
                </div>
              </div>
              <span className="text-4xl">♨️</span>
            </div>
          </div>
          <Link
            href="/technician/visits/demo"
            className="flex h-14 items-center justify-center gap-3 rounded-xl bg-[#ff5a0a] font-semibold text-white"
          >
            Einsatz starten <ArrowRight className="size-5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
