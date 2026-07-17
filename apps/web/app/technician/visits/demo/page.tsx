'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  Check,
  ChevronLeft,
  CircleCheck,
  Clock3,
  FileSignature,
  MessageSquare,
  PackagePlus,
  Phone,
  Plus,
  Send,
  ShoppingCart,
  Wrench,
} from 'lucide-react';

const parts = [
  ['Umwälzpumpe', '0020107723', '189,00 €', '4'],
  ['Zündelektrode', '0020049876', '24,90 €', '12'],
  ['Dichtungssatz', '0020018475', '15,60 €', '5'],
  ['Drucksensor', '0020059712', '38,50 €', '3'],
];

export default function TechnicianVisitPage() {
  const [completed, setCompleted] = useState(false);
  const [selectedParts, setSelectedParts] = useState<string[]>([]);

  const togglePart = (part: string) => {
    setSelectedParts((current) =>
      current.includes(part)
        ? current.filter((item) => item !== part)
        : [...current, part],
    );
  };

  return (
    <div className="mx-auto max-w-[1500px] p-4 lg:p-6">
      <div className="mb-4 flex items-center gap-4">
        <Link
          href="/technician/today"
          className="flex size-10 items-center justify-center rounded-full border bg-white"
        >
          <ChevronLeft />
        </Link>
        <h1 className="text-xl font-bold lg:text-2xl">
          Einsatz #2024-0715-001
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            completed
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {completed ? 'Abgeschlossen' : 'In Arbeit'}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr_390px]">
        <div className="space-y-4">
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">
              Kunde
            </div>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">Müller, Peter</h2>
                <p className="mt-2 text-slate-600">
                  Friedrichstraße 12
                  <br />
                  16303 Schwedt/Oder
                </p>
              </div>
              <div className="flex gap-2">
                <button className="flex size-10 items-center justify-center rounded-full border">
                  <Phone className="size-5" />
                </button>
                <button className="flex size-10 items-center justify-center rounded-full border">
                  <MessageSquare className="size-5" />
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">
              Gerät
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Vaillant ecoTEC plus</h3>
                <div className="mt-1 text-sm text-slate-500">
                  SN: 21087465123
                </div>
                <div className="text-sm text-slate-500">Baujahr: 2018</div>
              </div>
              <span className="text-5xl">♨️</span>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">
              Problem / Beschreibung
            </div>
            <p className="mt-3">
              Heizung wird nicht warm, Heizkörper bleiben kalt.
            </p>
          </section>

          <section className="rounded-2xl border bg-white p-5 text-sm shadow-sm">
            <div className="mb-4 text-xs font-semibold text-slate-500 uppercase">
              Einsatzdetails
            </div>
            {[
              ['Auftragsnummer', '2024-0715-001'],
              ['Priorität', 'Hoch'],
              ['Termin', '15.07.2026 10:30'],
              ['Einsatzart', 'Wartung / Reparatur'],
              ['Servicebereich', 'Schwedt/Oder'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between border-b py-3 last:border-0"
              >
                <span className="text-slate-500">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </section>
        </div>

        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="flex border-b px-5">
            <button className="border-b-2 border-[#ff5a0a] px-2 py-4 text-sm font-semibold text-[#ff5a0a]">
              ARBEITSPROTOKOLL
            </button>
            <button className="px-5 py-4 text-sm text-slate-500">
              HISTORIE
            </button>
            <button className="px-5 py-4 text-sm text-slate-500">
              DOKUMENTE
            </button>
          </div>

          <div className="p-5">
            <div className="space-y-0">
              {[
                ['10:35', 'Angekommen beim Kunden', true],
                ['10:40', 'Problem analysiert', true],
                ['10:45', 'Ersatzteile benötigt', selectedParts.length > 0],
                ['—', 'Reparatur durchführen', completed],
                ['—', 'Funktionsprüfung', completed],
                ['—', 'Einsatz abschließen', completed],
              ].map(([time, label, done], index) => (
                <div key={label as string} className="flex min-h-20 gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex size-7 items-center justify-center rounded-full border-2 ${
                        done
                          ? 'border-emerald-500 text-emerald-600'
                          : 'border-slate-300 text-slate-300'
                      }`}
                    >
                      {done ? (
                        <Check className="size-4" />
                      ) : (
                        <Clock3 className="size-4" />
                      )}
                    </span>
                    {index < 5 && <span className="h-full w-px bg-slate-200" />}
                  </div>
                  <div className="flex-1 pb-6">
                    <span className="mr-4 text-sm font-semibold">
                      {time as string}
                    </span>
                    <span className={done ? 'font-semibold' : 'text-slate-500'}>
                      {label as string}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <textarea
              className="mt-5 min-h-24 w-full rounded-xl border p-4 outline-none focus:border-[#ff5a0a]"
              placeholder="Notiz eingeben…"
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button className="flex h-12 items-center justify-center gap-2 rounded-xl border">
                <Camera className="size-5" /> Foto aufnehmen
              </button>
              <button className="flex h-12 items-center justify-center gap-2 rounded-xl border">
                <FileSignature className="size-5" /> Unterschrift
              </button>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {!completed ? (
            <section className="rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b p-5">
                <div className="text-sm font-semibold text-slate-500 uppercase">
                  Ersatzteile bestellen
                </div>
                <ShoppingCart className="size-5" />
              </div>
              <div className="p-4">
                <div className="mb-3 flex h-11 items-center gap-3 rounded-xl border px-3 text-sm text-slate-400">
                  <PackagePlus className="size-5" />
                  Teile suchen (Name, Art.-Nr.)
                </div>
                <div className="mb-2 text-xs font-semibold text-[#ff5a0a]">
                  HÄUFIG VERWENDET
                </div>
                {parts.map(([name, number, price, available]) => {
                  const selected = selectedParts.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => togglePart(name)}
                      className="flex w-full items-center gap-3 border-b py-3 text-left last:border-0"
                    >
                      <span className="flex size-12 items-center justify-center rounded-lg bg-slate-100 text-2xl">
                        ⚙️
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block">{name}</strong>
                        <span className="block text-xs text-slate-500">
                          Art.-Nr. {number}
                        </span>
                        <span className="mt-1 inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                          Verfügbar ({available})
                        </span>
                      </span>
                      <span className="text-sm font-semibold">{price}</span>
                      <span
                        className={`flex size-9 items-center justify-center rounded-lg border ${
                          selected
                            ? 'border-[#ff5a0a] bg-[#ff5a0a] text-white'
                            : ''
                        }`}
                      >
                        {selected ? <Check /> : <Plus />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button className="m-4 flex h-12 w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-xl border border-[#ff5a0a] font-semibold text-[#ff5a0a]">
                <Send className="size-5" /> Bestellung senden (
                {selectedParts.length})
              </button>
            </section>
          ) : (
            <>
              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-slate-500 uppercase">
                  Verwendete Ersatzteile
                </div>
                {['Umwälzpumpe', 'Dichtungssatz', 'Entlüfter'].map((part) => (
                  <div
                    key={part}
                    className="flex items-center gap-3 border-b py-4 last:border-0"
                  >
                    <span className="text-2xl">⚙️</span>
                    <strong className="flex-1">{part}</strong>
                    <span>1 ×</span>
                  </div>
                ))}
              </section>
              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-slate-500 uppercase">
                  Kundenunterschrift
                </div>
                <div className="mt-4 flex h-36 items-center justify-center rounded-xl border text-4xl italic">
                  Peter Müller
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 mt-4 flex justify-end border-t bg-[#f5f7fb]/95 py-4 backdrop-blur">
        <button
          onClick={() => setCompleted((value) => !value)}
          className="flex h-14 min-w-80 items-center justify-center gap-3 rounded-xl bg-[#ff5a0a] px-8 font-semibold text-white shadow-lg"
        >
          {completed ? (
            <>
              <Wrench className="size-5" /> Einsatz wieder öffnen
            </>
          ) : (
            <>
              <CircleCheck className="size-5" /> Einsatz abschließen
            </>
          )}
        </button>
      </div>
    </div>
  );
}
