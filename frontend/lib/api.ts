"use client";

import type {
  AccountStatus,
  AiWorkbench,
  AuditLogEntry,
  AuthResponse,
  CopilotResponse,
  DashboardData,
  EmployeeControlProfile,
  FinanceInvoice,
  FinanceLedgerEntry,
  HrEmployee,
  InventoryProduct,
  InventoryWarehouse,
  LeaveRequest,
  ModuleName,
  RegisterInput,
  SalesCustomer,
  SalesLead,
  SalesOrder,
  ScenarioInput,
  ScenarioResponse,
  SecurityOverview,
  UserProfile,
  UserRole
} from "@/types/erp";
import { dashboardFallback, fallbackCopilot, fallbackScenario, moduleFallbacks } from "@/lib/fallback-data";

const API_URL = process.env.NEXT_PUBLIC_ERP_API_URL ?? "http://localhost:4000";
export const AUTH_TOKEN_KEY = "erp-auth-token";
export const AUTH_USER_KEY = "erp-auth-user";

function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function getAuthHeaders(token?: string | null): Record<string, string> {
  const resolvedToken = token ?? getStoredToken();
  return resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {};
}

async function parseResponse<T>(response: Response) {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T | { message?: string; detail?: string }) : null;

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "message" in payload && payload.message
        ? payload.message
        : payload && typeof payload === "object" && "detail" in payload && payload.detail
          ? payload.detail
          : "Request failed.";
    throw new Error(errorMessage);
  }

  return payload as T;
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  return parseResponse<T>(response);
}

async function authedRequest<T>(path: string, init?: RequestInit, token?: string | null) {
  const resolvedToken = token ?? getStoredToken();
  if (!resolvedToken) {
    throw new Error("Authentication required.");
  }

  return requestJson<T>(path, {
    ...init,
    headers: {
      ...getAuthHeaders(resolvedToken),
      ...(init?.headers ?? {})
    }
  });
}

async function apiFetch<T>(path: string, fallback: T, init?: RequestInit, token?: string | null): Promise<T> {
  try {
    const resolvedToken = token ?? getStoredToken();
    if (!resolvedToken) {
      return fallback;
    }

    return await requestJson<T>(path, {
      ...init,
      headers: {
        ...getAuthHeaders(resolvedToken),
        ...(init?.headers ?? {})
      }
    });
  } catch {
    return fallback;
  }
}

export async function loginUser(email: string, password: string) {
  return requestJson<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function registerUser(input: RegisterInput) {
  return requestJson<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchCurrentUser(token: string) {
  return authedRequest<UserProfile>("/api/auth/me", undefined, token);
}

export async function fetchUsers(token: string) {
  return authedRequest<UserProfile[]>("/api/admin/users", undefined, token);
}

export async function updateUserRole(
  token: string,
  userId: string,
  payload: { role: UserRole; title?: string; department?: string }
) {
  return authedRequest<UserProfile>(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  }, token);
}

export async function updateAdminUser(
  token: string,
  userId: string,
  payload: {
    role?: UserRole;
    title?: string;
    department?: string;
    status?: AccountStatus;
    mustRotatePassword?: boolean;
  }
) {
  return authedRequest<UserProfile>(
    `/api/admin/users/${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function resetUserPassword(token: string, userId: string, password?: string) {
  return authedRequest<{ user: UserProfile; temporaryPassword: string; message: string }>(
    `/api/admin/users/${userId}/reset-password`,
    {
      method: "POST",
      body: JSON.stringify(password ? { password } : {})
    },
    token
  );
}

export async function unlockUserAccount(token: string, userId: string) {
  return authedRequest<UserProfile>(
    `/api/admin/users/${userId}/unlock`,
    {
      method: "POST",
      body: JSON.stringify({})
    },
    token
  );
}

export async function fetchEmployeeControl(token: string, userId: string) {
  return authedRequest<EmployeeControlProfile>(`/api/admin/users/${userId}/activity`, undefined, token);
}

export async function fetchSecurityOverview(token: string) {
  return authedRequest<SecurityOverview>("/api/admin/security/overview", undefined, token);
}

export async function fetchAiWorkbench(token?: string | null) {
  return authedRequest<AiWorkbench>("/api/ai/workbench", undefined, token);
}

export async function changePassword(
  payload: { currentPassword: string; nextPassword: string },
  token?: string | null
) {
  return authedRequest<{ message: string; user: UserProfile }>(
    "/api/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function fetchRecentActivity(token?: string | null) {
  return authedRequest<AuditLogEntry[]>("/api/account/recent-activity", undefined, token);
}

export async function fetchDashboard(token?: string | null): Promise<DashboardData> {
  return apiFetch("/api/dashboard/overview", dashboardFallback, undefined, token);
}

export async function fetchModule<T>(module: ModuleName, token?: string | null): Promise<T> {
  return apiFetch(`/api/modules/${module}`, moduleFallbacks[module] as T, undefined, token);
}

export async function simulateScenario(input: ScenarioInput, token?: string | null): Promise<ScenarioResponse> {
  return apiFetch(
    "/api/scenarios/simulate",
    fallbackScenario(input),
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    token
  );
}

export async function askCopilot(question: string, token?: string | null): Promise<CopilotResponse> {
  return apiFetch(
    "/api/copilot/query",
    fallbackCopilot(question),
    {
      method: "POST",
      body: JSON.stringify({ question })
    },
    token
  );
}

export async function fetchInventoryProducts(token?: string | null) {
  return authedRequest<InventoryProduct[]>("/api/inventory/products", undefined, token);
}

export async function fetchInventoryWarehouses(token?: string | null) {
  return authedRequest<InventoryWarehouse[]>("/api/inventory/warehouses", undefined, token);
}

export async function createInventoryProduct(payload: Omit<InventoryProduct, "id" | "trend">, token?: string | null) {
  return authedRequest<InventoryProduct>(
    "/api/inventory/products",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function updateInventoryProduct(
  productId: string,
  payload: Partial<Omit<InventoryProduct, "id">>,
  token?: string | null
) {
  return authedRequest<InventoryProduct>(
    `/api/inventory/products/${productId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function adjustInventoryStock(productId: string, payload: { delta: number; note?: string }, token?: string | null) {
  return authedRequest<InventoryProduct>(
    `/api/inventory/products/${productId}/adjust-stock`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function fetchEmployees(token?: string | null) {
  return authedRequest<HrEmployee[]>("/api/hr/employees", undefined, token);
}

export async function createEmployee(
  payload: Omit<HrEmployee, "id"> & { salary: number; status: "active" | "on-leave" | "inactive"; leaveBalance: number },
  token?: string | null
) {
  return authedRequest<HrEmployee>(
    "/api/hr/employees",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function updateEmployee(employeeId: string, payload: Partial<HrEmployee>, token?: string | null) {
  return authedRequest<HrEmployee>(
    `/api/hr/employees/${employeeId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function fetchLeaveRequests(token?: string | null) {
  return authedRequest<LeaveRequest[]>("/api/hr/leave-requests", undefined, token);
}

export async function createLeaveRequest(
  payload: Pick<LeaveRequest, "employeeId" | "startDate" | "endDate" | "reason">,
  token?: string | null
) {
  return authedRequest<LeaveRequest>(
    "/api/hr/leave-requests",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function updateLeaveRequestStatus(
  leaveRequestId: string,
  payload: Pick<LeaveRequest, "status">,
  token?: string | null
) {
  return authedRequest<LeaveRequest>(
    `/api/hr/leave-requests/${leaveRequestId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function fetchInvoices(token?: string | null) {
  return authedRequest<FinanceInvoice[]>("/api/finance/invoices", undefined, token);
}

export async function createInvoice(
  payload: Omit<FinanceInvoice, "id">,
  token?: string | null
) {
  return authedRequest<FinanceInvoice>(
    "/api/finance/invoices",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function updateInvoice(invoiceId: string, payload: Partial<FinanceInvoice>, token?: string | null) {
  return authedRequest<FinanceInvoice>(
    `/api/finance/invoices/${invoiceId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function fetchLedgerEntries(token?: string | null) {
  return authedRequest<FinanceLedgerEntry[]>("/api/finance/ledger", undefined, token);
}

export async function createLedgerEntry(
  payload: Omit<FinanceLedgerEntry, "id">,
  token?: string | null
) {
  return authedRequest<FinanceLedgerEntry>(
    "/api/finance/ledger",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function fetchLeads(token?: string | null) {
  return authedRequest<SalesLead[]>("/api/sales/leads", undefined, token);
}

export async function createLead(payload: Omit<SalesLead, "id">, token?: string | null) {
  return authedRequest<SalesLead>(
    "/api/sales/leads",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function updateLead(leadId: string, payload: Partial<SalesLead>, token?: string | null) {
  return authedRequest<SalesLead>(
    `/api/sales/leads/${leadId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function fetchCustomers(token?: string | null) {
  return authedRequest<SalesCustomer[]>("/api/sales/customers", undefined, token);
}

export async function createCustomer(payload: Omit<SalesCustomer, "id">, token?: string | null) {
  return authedRequest<SalesCustomer>(
    "/api/sales/customers",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function fetchSalesOrders(token?: string | null) {
  return authedRequest<SalesOrder[]>("/api/sales/orders", undefined, token);
}

export async function createSalesOrder(payload: SalesOrder, token?: string | null) {
  return authedRequest<SalesOrder>(
    "/api/sales/orders",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}
