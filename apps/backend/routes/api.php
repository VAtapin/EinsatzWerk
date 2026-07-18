<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CustomerAssetController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\CustomerDocumentController;
use App\Http\Controllers\Api\V1\CustomerLocationController;
use App\Http\Controllers\Api\V1\CustomerSearchController;
use App\Http\Controllers\Api\V1\DispatchController;
use App\Http\Controllers\Api\V1\MessageController;
use App\Http\Controllers\Api\V1\OfficeShellController;
use App\Http\Controllers\Api\V1\OfficeWorkspaceController;
use App\Http\Controllers\Api\V1\PartRequirementController;
use App\Http\Controllers\Api\V1\ServiceOrderController;
use App\Http\Controllers\Api\V1\TechnicianVisitController;
use App\Http\Controllers\Api\V1\TelephonyController;
use App\Http\Controllers\Api\V1\TelephonyWebhookController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:10,1');
    Route::get(
        'telephony/{provider}/{key}/contacts',
        [TelephonyWebhookController::class, 'contacts'],
    )->middleware('throttle:120,1');
    Route::match(
        ['post', 'put'],
        'telephony/{provider}/{key}/events',
        [TelephonyWebhookController::class, 'events'],
    )->middleware('throttle:300,1');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::middleware('ability:office')->group(function (): void {
            Route::get('office/search', [OfficeShellController::class, 'search']);
            Route::get('office/notifications', [OfficeShellController::class, 'notifications']);
            Route::get('telephony/integrations', [TelephonyController::class, 'integrations']);
            Route::post('telephony/integrations', [TelephonyController::class, 'storeIntegration']);
            Route::patch('telephony/integrations/{telephonyIntegration}', [TelephonyController::class, 'updateIntegration']);
            Route::post('telephony/integrations/{telephonyIntegration}/rotate-key', [TelephonyController::class, 'rotateIntegrationKey']);
            Route::get('telephony/calls', [TelephonyController::class, 'calls']);
            Route::post('telephony/calls/{telephonyCall}/acknowledge', [TelephonyController::class, 'acknowledge']);
            Route::post('telephony/simulate', [TelephonyController::class, 'simulate']);
            Route::get('office/analytics', [OfficeWorkspaceController::class, 'analytics']);
            Route::get('assets', [OfficeWorkspaceController::class, 'assets']);
            Route::get('technicians/workspace', [OfficeWorkspaceController::class, 'technicians']);
            Route::post('technicians', [OfficeWorkspaceController::class, 'storeTechnician']);
            Route::patch('technicians/{technician}', [OfficeWorkspaceController::class, 'updateTechnician']);
            Route::get('service-areas', [OfficeWorkspaceController::class, 'serviceAreas']);
            Route::post('service-areas', [OfficeWorkspaceController::class, 'storeServiceArea']);
            Route::patch('service-areas/{serviceArea}', [OfficeWorkspaceController::class, 'updateServiceArea']);
            Route::post('service-areas/{serviceArea}/postal-codes', [OfficeWorkspaceController::class, 'storePostalCode']);
            Route::delete('service-areas/{serviceArea}/postal-codes/{postalCode}', [OfficeWorkspaceController::class, 'deletePostalCode']);
            Route::get('documents', [OfficeWorkspaceController::class, 'documents']);
            Route::get('documents/service/{visitDocument}', [OfficeWorkspaceController::class, 'downloadServiceDocument']);
            Route::get('settings', [OfficeWorkspaceController::class, 'settings']);
            Route::patch('settings', [OfficeWorkspaceController::class, 'updateSettings']);
            Route::get('messages', [MessageController::class, 'index']);
            Route::post('messages', [MessageController::class, 'store']);
            Route::patch('messages/{message}/read', [MessageController::class, 'read']);
            Route::get('customers/search', CustomerSearchController::class);
            Route::get('customers', [CustomerController::class, 'index']);
            Route::post('customers', [CustomerController::class, 'store']);
            Route::get('customers/{customer}', [CustomerController::class, 'show']);
            Route::patch('customers/{customer}', [CustomerController::class, 'update']);
            Route::post('customers/{customer}/locations', [CustomerLocationController::class, 'store']);
            Route::patch('customers/{customer}/locations/{serviceLocation}', [CustomerLocationController::class, 'update']);
            Route::post('customers/{customer}/assets', [CustomerAssetController::class, 'store']);
            Route::patch('customers/{customer}/assets/{asset}', [CustomerAssetController::class, 'update']);
            Route::post('customers/{customer}/documents', [CustomerDocumentController::class, 'store']);
            Route::get('customers/{customer}/documents/{document}', [CustomerDocumentController::class, 'download']);
            Route::get('service-orders', [ServiceOrderController::class, 'index']);
            Route::post('service-orders', [ServiceOrderController::class, 'store']);
            Route::get('service-orders/{serviceOrder}', [ServiceOrderController::class, 'show']);
            Route::post('service-orders/{serviceOrder}/assign', [ServiceOrderController::class, 'assign']);
            Route::get('technicians', [ServiceOrderController::class, 'technicians']);
            Route::get('dispatch/board', [DispatchController::class, 'board']);
            Route::patch('dispatch/visits/{visit}', [DispatchController::class, 'reschedule']);
            Route::get('dispatch/route', [DispatchController::class, 'route']);
            Route::post('dispatch/route/build', [DispatchController::class, 'buildRoute']);
            Route::get('part-requirements', [PartRequirementController::class, 'index']);
            Route::patch('part-requirements/{partRequirement}', [PartRequirementController::class, 'transition']);
        });

        Route::prefix('technician')
            ->middleware('ability:technician')
            ->group(function (): void {
                Route::get('visits', [TechnicianVisitController::class, 'index']);
                Route::get('today', [TechnicianVisitController::class, 'today']);
                Route::get('products', [TechnicianVisitController::class, 'products']);
                Route::get('customers', [TechnicianVisitController::class, 'customers']);
                Route::post('emergency-visits', [TechnicianVisitController::class, 'createEmergency']);
                Route::patch('profile', [TechnicianVisitController::class, 'updateProfile']);
                Route::get('messages', [MessageController::class, 'index']);
                Route::post('messages', [MessageController::class, 'store']);
                Route::patch('messages/{message}/read', [MessageController::class, 'read']);
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
