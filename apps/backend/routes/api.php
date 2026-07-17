<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CustomerSearchController;
use App\Http\Controllers\Api\V1\ServiceOrderController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:10,1');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::middleware('ability:office')->group(function (): void {
            Route::get('customers/search', CustomerSearchController::class);
            Route::post('service-orders', [ServiceOrderController::class, 'store']);
        });
    });
});
