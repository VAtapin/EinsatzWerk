'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { apiDownload, apiRequest, getAccessToken } from '@/lib/einsatzwerk-api';

type Product = {
  id: string;
  article_number: string | null;
  name: string;
  price: string | null;
};

type Visit = {
  id: string;
  status: string;
  planned_start_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  diagnosis: string | null;
  work_performed: string | null;
  result: string | null;
  technician_notes: string | null;
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
  parts: Array<{
    id: string;
    description: string;
    quantity: string;
    status: string;
  }>;
  used_parts: Array<{
    id: string;
    description: string;
    quantity: string;
  }>;
  documents: Array<{
    id: string;
    type: string;
    name: string;
    download_path: string;
    metadata: { signer_name?: string } | null;
  }>;
  work_duration_minutes: number | null;
};

function displayTime(value: string | null): string {
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

export default function TechnicianVisitPage() {
  const params = useParams<{ visit: string }>();
  const router = useRouter();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [customPart, setCustomPart] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const signatureCanvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const selected = useMemo(
    () => products.filter((product) => selectedProducts.includes(product.id)),
    [products, selectedProducts],
  );

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    Promise.all([
      apiRequest<{ data: Visit }>(`/technician/visits/${params.visit}`),
      apiRequest<{ data: Product[] }>('/technician/products'),
    ])
      .then(([visitResult, productsResult]) => {
        setVisit(visitResult.data);
        setProducts(productsResult.data);
        setDiagnosis(visitResult.data.diagnosis ?? '');
        setWorkPerformed(visitResult.data.work_performed ?? '');
        setNotes(visitResult.data.technician_notes ?? '');
      })
      .catch((error: Error & { status?: number }) => {
        if (error.status === 401 || error.status === 403) {
          router.replace('/login');
        } else if (error.status === 404) {
          router.replace('/technician/today');
        }
      });
  }, [params.visit, router]);

  async function startVisit() {
    setBusy(true);
    try {
      const result = await apiRequest<{ data: Visit }>(
        `/technician/visits/${params.visit}/start`,
        { method: 'POST' },
      );
      setVisit(result.data);
      toast.success('Einsatz gestartet.');
    } catch {
      toast.error('Einsatz konnte nicht gestartet werden.');
    } finally {
      setBusy(false);
    }
  }

  async function sendParts() {
    if (selected.length === 0 && !customPart.trim()) return;
    setBusy(true);
    try {
      const requests = selected.map((product) =>
        apiRequest(`/technician/visits/${params.visit}/parts`, {
          method: 'POST',
          body: JSON.stringify({
            product_id: product.id,
            description: product.name,
            quantity: 1,
          }),
        }),
      );
      if (customPart.trim()) {
        requests.push(
          apiRequest(`/technician/visits/${params.visit}/parts`, {
            method: 'POST',
            body: JSON.stringify({
              description: customPart.trim(),
              quantity: 1,
            }),
          }),
        );
      }
      await Promise.all(requests);
      const refreshed = await apiRequest<{ data: Visit }>(
        `/technician/visits/${params.visit}`,
      );
      setVisit(refreshed.data);
      setSelectedProducts([]);
      setCustomPart('');
      toast.success('Ersatzteilbedarf wurde gesendet.');
    } catch {
      toast.error('Bestellung konnte nicht gesendet werden.');
    } finally {
      setBusy(false);
    }
  }

  async function bookUsedParts() {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      await Promise.all(
        selected.map((product) =>
          apiRequest(`/technician/visits/${params.visit}/used-parts`, {
            method: 'POST',
            body: JSON.stringify({
              product_id: product.id,
              description: product.name,
              quantity: 1,
              unit_price: product.price,
            }),
          }),
        ),
      );
      const refreshed = await apiRequest<{ data: Visit }>(
        `/technician/visits/${params.visit}`,
      );
      setVisit(refreshed.data);
      setSelectedProducts([]);
      toast.success('Verwendete Teile wurden gebucht.');
    } catch {
      toast.error('Teileverbrauch konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    const form = new FormData();
    form.append('photo', file);
    setBusy(true);
    try {
      await apiRequest(`/technician/visits/${params.visit}/photos`, {
        method: 'POST',
        body: form,
      });
      const refreshed = await apiRequest<{ data: Visit }>(
        `/technician/visits/${params.visit}`,
      );
      setVisit(refreshed.data);
      toast.success('Foto wurde gespeichert.');
    } catch {
      toast.error('Foto konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function saveSignature() {
    const canvas = signatureCanvas.current;
    if (!canvas || !signerName.trim()) return;
    setBusy(true);
    try {
      await apiRequest(`/technician/visits/${params.visit}/signature`, {
        method: 'POST',
        body: JSON.stringify({
          data_url: canvas.toDataURL('image/png'),
          signer_name: signerName.trim(),
        }),
      });
      const refreshed = await apiRequest<{ data: Visit }>(
        `/technician/visits/${params.visit}`,
      );
      setVisit(refreshed.data);
      setShowSignature(false);
      toast.success('Unterschrift wurde gespeichert.');
    } catch {
      toast.error('Unterschrift konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function completeVisit() {
    if (!workPerformed.trim()) {
      toast.error('Bitte die ausgeführten Arbeiten dokumentieren.');
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<{ data: Visit }>(
        `/technician/visits/${params.visit}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({
            diagnosis,
            work_performed: workPerformed,
            result: 'fixed',
            follow_up_required: false,
            technician_notes: notes,
          }),
        },
      );
      setVisit(result.data);
      toast.success('Einsatz abgeschlossen.');
    } catch {
      toast.error('Einsatz konnte nicht abgeschlossen werden.');
    } finally {
      setBusy(false);
    }
  }

  if (!visit) {
    return <div className="p-10 text-center">Einsatz wird geladen…</div>;
  }

  const completed = visit.status === 'completed';
  const inProgress = visit.status === 'in_progress';

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
          Einsatz #{visit.order.order_number}
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            completed
              ? 'bg-emerald-100 text-emerald-700'
              : inProgress
                ? 'bg-orange-100 text-orange-700'
                : 'bg-blue-100 text-blue-700'
          }`}
        >
          {completed ? 'Abgeschlossen' : inProgress ? 'In Arbeit' : 'Geplant'}
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
                <h2 className="text-2xl font-bold">{visit.customer.name}</h2>
                <p className="mt-2 text-slate-600">{address(visit)}</p>
              </div>
              <div className="flex gap-2">
                {visit.customer.primary_phone && (
                  <a
                    href={`tel:${visit.customer.primary_phone}`}
                    className="flex size-10 items-center justify-center rounded-full border"
                  >
                    <Phone className="size-5" />
                  </a>
                )}
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
            <h3 className="mt-4 text-lg font-bold">
              {visit.asset?.model ?? 'Kein Gerät zugeordnet'}
            </h3>
            {visit.asset?.serial_number && (
              <div className="mt-1 text-sm text-slate-500">
                SN: {visit.asset.serial_number}
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">
              Problem / Beschreibung
            </div>
            <p className="mt-3">{visit.order.fault_description}</p>
          </section>
        </div>

        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 text-sm font-semibold text-[#ff5a0a]">
            ARBEITSPROTOKOLL
          </div>
          <div className="space-y-5 p-5">
            {[
              ['Geplant', displayTime(visit.planned_start_at), true],
              [
                'Einsatz gestartet',
                displayTime(visit.actual_start_at),
                inProgress || completed,
              ],
              [
                'Ersatzteilbedarf',
                `${visit.parts.length} Positionen`,
                visit.parts.length > 0,
              ],
              [
                'Einsatz abgeschlossen',
                displayTime(visit.actual_end_at),
                completed,
              ],
            ].map(([label, value, done]) => (
              <div key={label as string} className="flex items-center gap-4">
                <span
                  className={`flex size-8 items-center justify-center rounded-full border-2 ${
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
                <div className="flex-1">
                  <strong>{label as string}</strong>
                  <div className="text-sm text-slate-500">
                    {value as string}
                  </div>
                </div>
              </div>
            ))}

            <label className="block text-sm font-semibold">Diagnose</label>
            <textarea
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
              disabled={completed}
              className="min-h-20 w-full rounded-xl border p-3"
              placeholder="Ursache des Fehlers…"
            />
            <label className="block text-sm font-semibold">
              Ausgeführte Arbeiten
            </label>
            <textarea
              value={workPerformed}
              onChange={(event) => setWorkPerformed(event.target.value)}
              disabled={completed}
              className="min-h-28 w-full rounded-xl border p-3"
              placeholder="Arbeiten und Funktionsprüfung dokumentieren…"
            />
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={completed}
              className="min-h-20 w-full rounded-xl border p-3"
              placeholder="Weitere Notiz…"
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border">
                <Camera className="size-5" /> Foto ({visit.documents.filter((document) => document.type === 'photo').length})
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={!inProgress || busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadPhoto(file);
                  }}
                />
              </label>
              <button
                onClick={() => setShowSignature(true)}
                disabled={!inProgress}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border disabled:opacity-40"
              >
                <FileSignature className="size-5" /> Unterschrift
              </button>
            </div>
          </div>
        </section>

        <section className="h-fit rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-5">
            <div className="text-sm font-semibold text-slate-500 uppercase">
              {completed ? 'Verwendete Ersatzteile' : 'Ersatzteile bestellen'}
            </div>
            <ShoppingCart className="size-5" />
          </div>
          <div className="p-4">
            {visit.parts.map((part) => (
              <div
                key={part.id}
                className="flex items-center gap-3 border-b py-3"
              >
                <PackagePlus className="size-5 text-[#ff5a0a]" />
                <strong className="flex-1">{part.description}</strong>
                <span>{Number(part.quantity)} ×</span>
              </div>
            ))}
            {visit.used_parts.map((part) => (
              <div key={part.id} className="flex items-center gap-3 border-b bg-emerald-50 py-3">
                <CircleCheck className="size-5 text-emerald-600" />
                <strong className="flex-1">{part.description}</strong>
                <span>{Number(part.quantity)} × verbraucht</span>
              </div>
            ))}
            {!completed && inProgress && (
              <div className="mb-3 flex gap-2">
                <input
                  value={customPart}
                  onChange={(event) => setCustomPart(event.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm"
                  placeholder="Freie Teilebezeichnung…"
                />
                <button
                  onClick={sendParts}
                  disabled={!customPart.trim() || busy}
                  className="rounded-xl border px-4 text-sm font-semibold"
                >
                  Senden
                </button>
              </div>
            )}
            {!completed &&
              products.map((product) => {
                const checked = selectedProducts.includes(product.id);
                return (
                  <button
                    key={product.id}
                    disabled={!inProgress}
                    onClick={() =>
                      setSelectedProducts((current) =>
                        checked
                          ? current.filter((id) => id !== product.id)
                          : [...current, product.id],
                      )
                    }
                    className="flex w-full items-center gap-3 border-b py-3 text-left disabled:opacity-50"
                  >
                    <PackagePlus className="size-5" />
                    <span className="min-w-0 flex-1">
                      <strong className="block">{product.name}</strong>
                      <span className="text-xs text-slate-500">
                        Art.-Nr. {product.article_number ?? '—'}
                      </span>
                    </span>
                    <span
                      className={`flex size-9 items-center justify-center rounded-lg border ${
                        checked ? 'bg-[#ff5a0a] text-white' : ''
                      }`}
                    >
                      {checked ? <Check /> : <Plus />}
                    </span>
                  </button>
                );
              })}
          </div>
          {!completed && (
            <div className="m-4 grid grid-cols-2 gap-2">
              <button
                onClick={bookUsedParts}
                disabled={!inProgress || selected.length === 0 || busy}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-40"
              >
                <Check className="size-5" /> Verbraucht buchen
              </button>
              <button
                onClick={sendParts}
                disabled={!inProgress || (selected.length === 0 && !customPart.trim()) || busy}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#ff5a0a] font-semibold text-[#ff5a0a] disabled:opacity-40"
              >
                <Send className="size-5" /> Bestellen
              </button>
            </div>
          )}
          {completed &&
            visit.documents
              .filter((document) => document.type === 'service_report')
              .map((document) => (
                <button
                  key={document.id}
                  onClick={() => apiDownload(document.download_path, document.name)}
                  className="m-4 flex h-12 w-[calc(100%-2rem)] items-center justify-center rounded-xl bg-[#061b31] font-semibold text-white"
                >
                  Servicebericht herunterladen
                </button>
              ))}
        </section>
      </div>

      <div className="sticky bottom-0 mt-4 flex justify-end border-t bg-[#f5f7fb]/95 py-4 backdrop-blur">
        {!inProgress && !completed && (
          <button
            onClick={startVisit}
            disabled={busy}
            className="flex h-14 min-w-80 items-center justify-center gap-3 rounded-xl bg-[#ff5a0a] px-8 font-semibold text-white"
          >
            <CircleCheck className="size-5" /> Einsatz starten
          </button>
        )}
        {inProgress && (
          <button
            onClick={completeVisit}
            disabled={busy}
            className="flex h-14 min-w-80 items-center justify-center gap-3 rounded-xl bg-[#ff5a0a] px-8 font-semibold text-white"
          >
            <CircleCheck className="size-5" /> Einsatz abschließen
          </button>
        )}
        {completed && (
          <div className="flex h-14 min-w-80 items-center justify-center gap-3 rounded-xl bg-emerald-100 font-semibold text-emerald-700">
            <CircleCheck className="size-5" /> Arbeit abgeschlossen
          </div>
        )}
      </div>

      {showSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-5">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-xl font-bold">Kundenunterschrift</h2>
            <input
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              className="mt-4 h-11 w-full rounded-xl border px-3"
              placeholder="Name des Unterzeichners"
            />
            <canvas
              ref={signatureCanvas}
              width={700}
              height={220}
              onPointerDown={(event) => {
                drawing.current = true;
                const canvas = signatureCanvas.current;
                const context = canvas?.getContext('2d');
                const rect = canvas?.getBoundingClientRect();
                if (canvas && context && rect) {
                  context.beginPath();
                  context.moveTo(
                    (event.clientX - rect.left) * (canvas.width / rect.width),
                    (event.clientY - rect.top) * (canvas.height / rect.height),
                  );
                }
              }}
              onPointerMove={(event) => {
                if (!drawing.current) return;
                const canvas = signatureCanvas.current;
                const context = canvas?.getContext('2d');
                const rect = canvas?.getBoundingClientRect();
                if (canvas && context && rect) {
                  context.lineWidth = 2.5;
                  context.lineCap = 'round';
                  context.lineTo(
                    (event.clientX - rect.left) * (canvas.width / rect.width),
                    (event.clientY - rect.top) * (canvas.height / rect.height),
                  );
                  context.stroke();
                }
              }}
              onPointerUp={() => (drawing.current = false)}
              onPointerLeave={() => (drawing.current = false)}
              className="mt-4 h-56 w-full touch-none rounded-xl border bg-white"
            />
            <div className="mt-4 flex justify-between gap-3">
              <button
                onClick={() => signatureCanvas.current?.getContext('2d')?.clearRect(0, 0, 700, 220)}
                className="h-11 rounded-xl border px-5"
              >
                Löschen
              </button>
              <div className="flex gap-3">
                <button onClick={() => setShowSignature(false)} className="h-11 rounded-xl border px-5">
                  Abbrechen
                </button>
                <button
                  onClick={saveSignature}
                  disabled={!signerName.trim() || busy}
                  className="h-11 rounded-xl bg-[#ff5a0a] px-6 font-semibold text-white disabled:opacity-40"
                >
                  Unterschrift speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
