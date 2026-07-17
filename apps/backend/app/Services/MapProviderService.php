<?php

namespace App\Services;

use App\Models\ServiceLocation;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class MapProviderService
{
    /**
     * @return array{latitude: float, longitude: float}
     */
    public function geocode(ServiceLocation $location): array
    {
        if ($location->latitude !== null && $location->longitude !== null) {
            return [
                'latitude' => (float) $location->latitude,
                'longitude' => (float) $location->longitude,
            ];
        }
        $response = Http::acceptJson()
            ->withUserAgent(config('services.maps.user_agent'))
            ->timeout(15)
            ->retry(2, 500)
            ->get(rtrim(config('services.maps.geocoding_url'), '/').'/search', [
                'street' => trim("{$location->house_number} {$location->street}"),
                'postalcode' => $location->postal_code,
                'city' => $location->city,
                'countrycodes' => strtolower($location->country ?: 'DE'),
                'format' => 'jsonv2',
                'limit' => 1,
            ])
            ->throw()
            ->json();
        $result = $response[0] ?? null;
        if (! is_array($result) || ! isset($result['lat'], $result['lon'])) {
            throw new RuntimeException("Adresse {$location->id} konnte nicht geocodiert werden.");
        }
        $location->update([
            'latitude' => $result['lat'],
            'longitude' => $result['lon'],
            'geocoding_provider' => config('services.maps.geocoding_provider'),
            'geocoded_at' => now(),
            'geocoding_data' => [
                'place_id' => $result['place_id'] ?? null,
                'display_name' => $result['display_name'] ?? null,
                'type' => $result['type'] ?? null,
            ],
        ]);

        return ['latitude' => (float) $result['lat'], 'longitude' => (float) $result['lon']];
    }

    /**
     * @param  array<int, array{latitude: float, longitude: float}>  $points
     * @return array{distance: int, duration: int, geometry: array<string, mixed>}
     */
    public function route(array $points): array
    {
        if (count($points) < 2) {
            return [
                'distance' => 0,
                'duration' => 0,
                'geometry' => [
                    'type' => 'LineString',
                    'coordinates' => array_map(
                        fn (array $point) => [$point['longitude'], $point['latitude']],
                        $points,
                    ),
                ],
            ];
        }
        $coordinates = implode(';', array_map(
            fn (array $point) => "{$point['longitude']},{$point['latitude']}",
            $points,
        ));
        $payload = Http::acceptJson()
            ->timeout(20)
            ->retry(2, 500)
            ->get(
                rtrim(config('services.maps.routing_url'), '/')."/route/v1/driving/{$coordinates}",
                ['overview' => 'full', 'geometries' => 'geojson', 'steps' => 'false'],
            )
            ->throw()
            ->json();
        $route = $payload['routes'][0] ?? null;
        if (($payload['code'] ?? null) !== 'Ok' || ! is_array($route)) {
            throw new RuntimeException('Für die Stopps konnte keine Route berechnet werden.');
        }

        return [
            'distance' => (int) round($route['distance']),
            'duration' => (int) round($route['duration']),
            'geometry' => $route['geometry'],
        ];
    }
}
