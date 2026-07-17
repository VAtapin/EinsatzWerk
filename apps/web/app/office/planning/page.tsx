'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { CalendarDays, Clock3, GripVertical, MapPin, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, getAccessToken } from '@/lib/einsatzwerk-api';

type Order = {
  id: string;
  order_number: string;
  fault_description: string;
  priority: string;
  customer: { first_name: string | null; last_name: string; company_name: string | null };
  service_location: { city: string | null; street: string | null };
};

type Visit = {
  id: string;
  planned_start_at: string;
  planned_end_at: string;
  lock_version: number;
  service_order: Order;
};

type Technician = {
  id: string;
  name: string;
  assigned_visits: Visit[];
};

type Board = {
  date: string;
  technicians: Technician[];
  unassigned_orders: Order[];
};

type RouteData = {
  id: string;
  distance_meters: number;
  duration_seconds: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
  stops: Array<{
    id: string;
    sequence: number;
    latitude: number;
    longitude: number;
    customer: string;
  }>;
};

const RouteMap = dynamic(() => import('@/components/einsatzwerk/route-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center">
      Karte wird geladen…
    </div>
  ),
});

function localDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function name(order: Order): string {
  return order.customer.company_name ||
    [order.customer.first_name, order.customer.last_name].filter(Boolean).join(' ');
}

export default function PlanningPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => localDate(new Date()));
  const [board, setBoard] = useState<Board | null>(null);
  const [moving, setMoving] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeTechnicianId, setRouteTechnicianId] = useState('');
  const hours = useMemo(() => Array.from({ length: 11 }, (_, index) => index + 7), []);

  const load = useCallback(async () => {
    try {
      const result = await apiRequest<{ data: Board }>(`/dispatch/board?date=${date}`);
      setBoard(result.data);
      setRouteTechnicianId((current) =>
        result.data.technicians.some((technician) => technician.id === current)
          ? current
          : (result.data.technicians[0]?.id ?? ''),
      );
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      if (status === 401 || status === 403) router.replace('/login');
      else toast.error('Planung konnte nicht geladen werden.');
    }
  }, [date, router]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    load();
  }, [load, router]);

  async function drop(
    payload: { type: 'visit' | 'order'; id: string },
    technicianId: string,
    hour: number,
  ) {
    if (!board || moving) return;
    const startsAt = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
    setMoving(true);
    try {
      if (payload.type === 'order') {
        await apiRequest(`/service-orders/${payload.id}/assign`, {
          method: 'POST',
          body: JSON.stringify({
            technician_id: technicianId,
            planned_start_at: startsAt.toISOString(),
            planned_end_at: new Date(startsAt.getTime() + 60 * 60_000).toISOString(),
            duration_minutes: 60,
          }),
        });
      } else {
        const visit = board.technicians
          .flatMap((technician) => technician.assigned_visits)
          .find((candidate) => candidate.id === payload.id);
        if (!visit) return;
        const duration = new Date(visit.planned_end_at).getTime() -
          new Date(visit.planned_start_at).getTime();
        await apiRequest(`/dispatch/visits/${visit.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            technician_id: technicianId,
            planned_start_at: startsAt.toISOString(),
            planned_end_at: new Date(startsAt.getTime() + duration).toISOString(),
            lock_version: visit.lock_version,
          }),
        });
      }
      toast.success('Planung wurde aktualisiert.');
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setMoving(false);
    }
  }

  async function calculateRoute() {
    if (!routeTechnicianId) return;
    setMoving(true);
    try {
      const result = await apiRequest<{ data: RouteData }>(
        '/dispatch/route/build',
        {
          method: 'POST',
          body: JSON.stringify({ date, technician_id: routeTechnicianId }),
        },
      );
      setRouteData(result.data);
      toast.success('Route wurde berechnet und gespeichert.');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="min-w-[1180px] px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">3. PLANUNG & DISPOSITION</h1>
          <p className="mt-1 text-sm text-slate-500">Aufträge per Drag-and-drop einplanen</p>
        </div>
        <label className="flex h-11 items-center gap-3 rounded-lg border bg-white px-4">
          <CalendarDays className="size-4 text-[#ff5a0a]" />
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4">
        <aside className="rounded-xl border bg-white">
          <div className="border-b p-4 font-semibold">
            Ungeplante Aufträge ({board?.unassigned_orders.length ?? 0})
          </div>
          <div className="space-y-2 p-3">
            {board?.unassigned_orders.map((order) => (
              <article
                key={order.id}
                draggable
                onDragStart={(event) =>
                  event.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'order',
                    id: order.id,
                  }))
                }
                className="cursor-grab rounded-lg border border-orange-200 bg-orange-50 p-3 active:cursor-grabbing"
              >
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <GripVertical className="size-4" /> {order.order_number}
                </div>
                <strong className="mt-1 block text-sm">{name(order)}</strong>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{order.fault_description}</p>
              </article>
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded-xl border bg-white">
          <div className="grid grid-cols-[190px_repeat(11,minmax(84px,1fr))] border-b bg-slate-50">
            <div className="p-3 text-xs font-semibold text-slate-500">Techniker</div>
            {hours.map((hour) => (
              <div key={hour} className="border-l p-3 text-center text-xs text-slate-500">
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {board?.technicians.map((technician) => (
            <div
              key={technician.id}
              className="grid min-h-28 grid-cols-[190px_repeat(11,minmax(84px,1fr))] border-b last:border-0"
            >
              <div className="p-4">
                <strong className="flex items-center gap-2 text-sm">
                  <UserRound className="size-4" /> {technician.name}
                </strong>
                <span className="mt-2 block text-xs text-slate-500">
                  {technician.assigned_visits.length} Einsätze
                </span>
              </div>
              {hours.map((hour) => {
                const visits = technician.assigned_visits.filter(
                  (visit) => new Date(visit.planned_start_at).getHours() === hour,
                );
                return (
                  <div
                    key={hour}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const value = event.dataTransfer.getData('application/json');
                      if (value) drop(JSON.parse(value), technician.id, hour);
                    }}
                    className="border-l p-1.5 transition hover:bg-blue-50"
                  >
                    {visits.map((visit) => (
                      <article
                        key={visit.id}
                        draggable
                        onDragStart={(event) =>
                          event.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'visit',
                            id: visit.id,
                          }))
                        }
                        className="cursor-grab rounded-md border border-blue-200 bg-blue-50 p-2 text-xs shadow-sm"
                      >
                        <strong className="block truncate">{name(visit.service_order)}</strong>
                        <span className="mt-1 flex items-center gap-1 text-slate-600">
                          <Clock3 className="size-3" />
                          {new Date(visit.planned_start_at).toLocaleTimeString('de-DE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="mt-1 flex items-center gap-1 truncate text-slate-500">
                          <MapPin className="size-3" />
                          {visit.service_order.service_location.city}
                        </span>
                      </article>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      </div>
      <section className="mt-4 overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <strong>Route & Karte</strong>
            {routeData && (
              <span className="ml-4 text-sm text-slate-500">
                {(routeData.distance_meters / 1000).toFixed(1)} km ·{' '}
                {Math.round(routeData.duration_seconds / 60)} min Fahrzeit
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={routeTechnicianId}
              onChange={(event) => {
                setRouteTechnicianId(event.target.value);
                setRouteData(null);
              }}
              className="h-10 rounded-lg border px-3 text-sm"
            >
              {board?.technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.name}
                </option>
              ))}
            </select>
            <button
              onClick={calculateRoute}
              disabled={!routeTechnicianId || moving}
              className="h-10 rounded-lg bg-[#061b31] px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              Route berechnen
            </button>
          </div>
        </div>
        {routeData ? (
          <div className="h-[430px]">
            <RouteMap route={routeData} />
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-slate-500">
            Techniker auswählen und Route berechnen.
          </div>
        )}
      </section>
    </div>
  );
}
