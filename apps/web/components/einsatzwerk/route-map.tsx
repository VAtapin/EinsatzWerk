'use client';

import type { LatLngExpression } from 'leaflet';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet';

type RouteData = {
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
  stops: Array<{
    id: string;
    sequence: number;
    latitude: number;
    longitude: number;
    customer: string;
  }>;
};

export default function RouteMap({ route }: { route: RouteData }) {
  const positions =
    route.geometry?.coordinates.map(
      ([longitude, latitude]) => [latitude, longitude] as LatLngExpression,
    ) ??
    route.stops.map(
      (stop) => [stop.latitude, stop.longitude] as LatLngExpression,
    );
  const center = positions[0] ?? [52.52, 13.405];

  return (
    <MapContainer center={center} zoom={10} className="h-full min-h-80 w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {positions.length > 1 && (
        <Polyline
          positions={positions}
          pathOptions={{ color: '#1769e0', weight: 5 }}
        />
      )}
      {route.stops.map((stop) => (
        <CircleMarker
          key={stop.id}
          center={[stop.latitude, stop.longitude]}
          radius={13}
          pathOptions={{
            color: '#fff',
            fillColor: '#ff5a0a',
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>
            {stop.sequence}. {stop.customer}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
