<?php

namespace Tests\Unit;

use App\Services\MapProviderService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MapProviderServiceTest extends TestCase
{
    public function test_osrm_geojson_route_is_mapped_to_the_internal_contract(): void
    {
        Http::fake([
            '*/route/v1/driving/*' => Http::response([
                'code' => 'Ok',
                'routes' => [[
                    'distance' => 16842.4,
                    'duration' => 1432.2,
                    'geometry' => [
                        'type' => 'LineString',
                        'coordinates' => [
                            [14.2829, 53.0598],
                            [13.8146, 52.8349],
                        ],
                    ],
                ]],
            ]),
        ]);

        $route = app(MapProviderService::class)->route([
            ['latitude' => 53.0598, 'longitude' => 14.2829],
            ['latitude' => 52.8349, 'longitude' => 13.8146],
        ]);

        $this->assertSame(16842, $route['distance']);
        $this->assertSame(1432, $route['duration']);
        $this->assertSame('LineString', $route['geometry']['type']);
        Http::assertSent(fn ($request) => str_contains(
            $request->url(),
            '14.2829,53.0598;13.8146,52.8349',
        ));
    }
}
