# EinsatzWerk Product Decisions

Status: living decision log
Updated: 2026-07-17

## Accepted foundation

- EinsatzWerk is a configurable Field Service Management platform.
- The first appliance-service customer defines MVP usefulness.
- The application starts as a modular monolith.
- Laravel is the authoritative backend and source of business rules.
- Filament is used only for the platform Superadmin.
- Next.js, React, TypeScript, and Metronic Tailwind power client interfaces.
- Office, dispatch, and technician experiences are separate workspaces.
- PostgreSQL, Redis, queues, S3-compatible storage, and Docker-ready deployment
  are part of the platform foundation.

## No generic Dashboard

There is no generic client Dashboard.

- Office landing page: `Anrufannahme`.
- Technician landing page: `Heute / Tagesplan`.
- Superadmin entry point: Filament.
- Analytics is a dedicated destination.

This decision favors operational work over decorative overview screens.

## Product is a workplace, not an ERP

The primary product metaphor is an operational workplace for dispatchers.
Information architecture begins with the incoming call, customer context, and
the next action.

Reporting and KPIs remain important, but they are subordinate decision-support
tools. They do not define the application home or force users through a
management overview before daily work.

Product test:

> If a dispatcher must pass a Dashboard before handling a call, the workflow is
> wrong.

## Metronic provides bricks, not finished rooms

Metronic is adopted for its reliable tables, forms, cards, search, drawers,
dialogs, tabs, timelines, notifications, navigation, tokens, and responsive
layout primitives.

EinsatzWerk does not inherit Metronic's generic Dashboard information
architecture. Business screens are designed from dispatcher and technician
tasks, then assembled from Metronic primitives. Application-level components
are extracted incrementally as patterns prove reusable.

## Route Assistant belongs to the pilot

The pilot includes a first useful route proposal, not only manual planning.

Baseline planning:

- manual assignment;
- drag-and-drop;
- manual sequence changes;
- distance and travel-time display;
- time-window validation;
- structured conflict warnings.

Route Assistant v1:

- proposes an ordered tour;
- considers workday start/end, breaks, service duration, service areas, and
  appointment constraints;
- respects locked stops;
- exposes warnings and infeasible constraints;
- lets the dispatcher accept, reject, or modify the proposal.

Research and a small provider/solver proof of concept begin early. The route
provider remains behind an application interface so the domain is not coupled
to a single vendor.

## Optimization and AI are separate

```text
Optimizer calculates.
AI explains, predicts, and suggests.
Human approves.
```

Route feasibility and sequence are calculated by a deterministic routing or
optimization engine. An LLM must not invent route order.

Possible later AI capabilities:

- problem classification from call notes;
- service-duration estimates;
- technician suggestions;
- service-report drafting;
- natural-language historical search;
- anomaly and repeat-visit detection.

AI suggestions retain their input, model/version, output, confidence where
available, and the human decision.

## Tenant-aware code, flexible deployment

Business data is tenant-aware from the beginning:

- `organization_id`;
- tenant request context;
- organization-scoped uniqueness;
- policies and permissions;
- cross-tenant leakage tests.

Physical deployment is a separate decision. The first customer may use an
isolated PostgreSQL database, object storage, Redis namespace, and domain while
sharing the same codebase and release process.

## Domain additions to validate

- `route_stops`, including non-visit stops and locked stops;
- `route_optimization_runs`;
- appointment constraints with hard/soft semantics;
- `scheduling_conflicts`;
- service locations;
- technician vehicles;
- skills and qualifications;
- normative, predicted, dispatcher-set, and actual durations;
- part requirements and inventory movements;
- communication history;
- import runs, row results, issues, and duplicate candidates.

These are architectural candidates until validated against legacy data and
interviews. They must not all become tables merely because they appear in this
document.

## First vertical slice

The first business screen is `Schnellannahme / Anrufannahme`, not a Dashboard.

The first complete slice covers:

```text
customer search
-> customer or service location
-> asset
-> problem
-> appointment constraints
-> service order
-> planning queue
```

The primary performance target is creation of a normal order within 60–90
seconds by a trained dispatcher.

## Offline boundary for MVP

The technician application:

- caches today's assignments and necessary details;
- reads visit information without a connection;
- stores text, photos, signatures, and commands locally;
- retries commands using client operation IDs;
- shows synchronization state;
- escalates domain conflicts for explicit resolution.

Full offline administration and unrestricted offline history are outside MVP.

## Deployment and local Docker

Docker is allowed for local PostgreSQL and Redis development infrastructure.
The production server is deployed natively and updated from the Git repository.

- Development artifacts are deployed directly to the target server.
- PostgreSQL, Redis, PHP, queue workers, scheduler, object storage access, and
  the web runtime are configured as server services.
- Testing and acceptance happen in the server environment.
- Deployment remains scripted and repeatable even though it is not
  containerized.
