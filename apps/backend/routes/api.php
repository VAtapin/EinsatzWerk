<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CustomerAssetController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\CustomerSearchController;
use App\Http\Controllers\Api\V1\DispatchController;
use App\Http\Controllers\Api\V1\ServiceOrderController;
use App\Http\Controllers\Api\V1\TechnicianVisitController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:10,1');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::middleware('ability:office')->group(function (): void {
            Route::get('customers/search', CustomerSearchController::class);
            Route::post('customers', [CustomerController::class, 'store']);
            Route::post('customers/{customer}/assets', [CustomerAssetController::class, 'store']);
            Route::get('service-orders', [ServiceOrderController::class, 'index']);
            Route::post('service-orders', [ServiceOrderController::class, 'store']);
            Route::get('service-orders/{serviceOrder}', [ServiceOrderController::class, 'show']);
            Route::post('service-orders/{serviceOrder}/assign', [ServiceOrderController::class, 'assign']);
            Route::get('technicians', [ServiceOrderController::class, 'technicians']);
            Route::get('dispatch/board', [DispatchController::class, 'board']);
            Route::patch('dispatch/visits/{visit}', [DispatchController::class, 'reschedule']);
            Route::get('dispatch/route', [DispatchController::class, 'route']);
            Route::post('dispatch/route/build', [DispatchController::class, 'buildRoute']);
        });

        Route::prefix('technician')
            ->middleware('ability:technician')
            ->group(function (): void {
                Route::get('today', [TechnicianVisitController::class, 'today']);
                Route::get('products', [TechnicianVisitController::class, 'products']);
                Route::get('visits/{visit}', [TechnicianVisitController::class, 'show']);
                Route::post('visits/{visit}/start', [TechnicianVisitController::class, 'start']);
                Route::post('visits/{visit}/parts', [TechnicianVisitController::class, 'requestPart']);
                Route::post('visits/{visit}/used-parts', [TechnicianVisitController::class, 'usePart']);
                Route::post('visits/{visit}/photos', [TechnicianVisitController::class, 'uploadPhoto']);
                Route::post('visits/{visit}/signature', [TechnicianVisitController::class, 'signature']);
                Route::post('visits/{visit}/complete', [TechnicianVisitController::class, 'complete']);
                Route::get('visits/{visit}/documents/{document}', [TechnicianVisitController::class, 'document']);
            });
    });
});
