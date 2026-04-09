# API Specification

## Authentication

### `POST /api/auth/login`

Demo request:

```json
{
  "email": "admin@northstar.com",
  "password": "password123"
}
```

Returns a JWT and tenant-scoped user payload.

### `GET /api/auth/me`

Returns the current authenticated user.

## REST Endpoints

### Gateway

- `GET /health`
- `GET /api/dashboard/overview`
- `GET /api/modules/:module`
- `GET /api/notifications`
- `GET /api/notifications/stream`
- `GET /api/audit-logs`
- `POST /api/scenarios/simulate`
- `POST /api/copilot/query`

### Domain services

- Inventory: `GET /api/inventory/overview`
- HR: `GET /api/hr/overview`
- Finance: `GET /api/finance/overview`
- Sales: `GET /api/sales/overview`
- Analytics: `GET /health`, `GET /models`, `POST /decision-intelligence`, `POST /scenario-simulation`, `POST /copilot/query`

## GraphQL

Endpoint:

```http
POST /graphql
Authorization: Bearer <token>
```

Example query:

```graphql
query DashboardSnapshot {
  dashboard {
    tenant
    generatedAt
    scorecard {
      growth
      operations
      financeHealth
      workforceHealth
    }
    intelligence {
      confidence
      operatingSignal
      insights {
        title
        owner
        impact
      }
    }
    notifications {
      title
      severity
      module
    }
  }
}
```

## RBAC Notes

- `ADMIN`
  - Full access to dashboard, module data, audit logs, AI actions
- `MANAGER`
  - Dashboard, module data, audit logs, AI actions
- `EMPLOYEE`
  - Dashboard and module data
  - No audit log access

