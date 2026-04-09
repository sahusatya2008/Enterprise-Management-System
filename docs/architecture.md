# ERP Architecture

## Style

The system is designed as a modular ERP platform with a gateway API and independently deployable domain services. The current implementation uses lightweight service boundaries with seeded repositories so the platform is runnable immediately, while the deployment shape already matches a microservice evolution path.

## Core Layers

1. `frontend/`
   - Next.js 15 web application
   - Tailwind CSS UI system
   - Executive cockpit, departmental dashboards, AI copilot, scenario simulator
2. `backend/`
   - ERP gateway and orchestration layer
   - JWT authentication and RBAC
   - REST + GraphQL APIs
   - Audit logs and realtime notifications stream
3. `services/*-service`
   - Inventory, HR, Finance, and Sales bounded contexts
   - Independent REST contracts for each domain
   - Ready for separate persistence and queue adapters
4. `services/analytics-service`
   - FastAPI service for forecasting, decision intelligence, and scenario simulation
   - Hybrid rule-based and regression-backed scoring
5. `postgres`, `redis`, `rabbitmq`
   - Included in deployment topology for persistence, caching, and async communication expansion

## Bounded Contexts

- Inventory
  - Product catalog
  - Warehouse operations
  - Low-stock alerts
  - Forecast-assisted replenishment
- HR
  - Workforce overview
  - Attendance and payroll analytics
  - Attrition risk and productivity
- Finance
  - Revenue, expenses, invoices, ledger
  - Margin and cash health
  - Cost optimization cues
- Sales
  - Pipeline management
  - Customer health
  - Opportunity scoring and forecast
- Analytics
  - Cross-module reasoning
  - Scenario simulation
  - Business copilot answers

## Event-Driven Pattern

The current gateway exposes a notification stream and records platform events through an internal bus. In production, the same event contracts should be published to RabbitMQ or Kafka topics such as:

- `inventory.stock.changed`
- `sales.pipeline.updated`
- `hr.attrition.alerted`
- `finance.margin.changed`
- `analytics.recommendation.created`

This gives each service a clean path toward asynchronous workflows, projections, and outbox patterns.

## Security Model

- JWT-based authentication
- RBAC with `ADMIN`, `MANAGER`, and `EMPLOYEE`
- Tenant scoping via `tenantId`
- Audit logs for dashboard access, logins, and AI actions
- Deployment-ready secret injection through environment variables

## Scale Path

1. Replace seeded repositories with PostgreSQL-backed repositories per service.
2. Add Redis caching for hot dashboards and AI summaries.
3. Move event emission to RabbitMQ or Kafka with consumers per service.
4. Introduce OLAP storage for long-term historical intelligence.
5. Add tenant-aware database schemas or row-level security for SaaS tenancy.

