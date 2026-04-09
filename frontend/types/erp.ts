export type ModuleName = "inventory" | "hr" | "finance" | "sales";
export type UserRole = "ADMIN" | "MANAGER" | "EMPLOYEE";
export type AccountStatus = "ACTIVE" | "SUSPENDED";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  tenantId: string;
  department: string;
  status: AccountStatus;
  mustRotatePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastPasswordChangeAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  token: string;
  user: UserProfile;
};

export type Insight = {
  title: string;
  summary: string;
  owner: string;
  impact: string;
  confidence: number;
};

export type Notification = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "info";
  module: string;
  detail: string;
  createdAt: string;
};

export type InventoryProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  supplier: string;
  warehouse: string;
  stock: number;
  reorderPoint: number;
  unitCost: number;
  trend: string;
};

export type InventoryWarehouse = {
  id: string;
  name: string;
  utilization: number;
  outboundToday: number;
  inboundToday: number;
};

export type InventoryModule = {
  tenantId: string;
  overview: {
    totalSkus: number;
    stockUnits: number;
    warehouses: number;
    lowStockItems: number;
    fulfillmentRate: number;
  };
  products: InventoryProduct[];
  warehouses: InventoryWarehouse[];
  alerts: Array<{
    id: string;
    severity: string;
    title: string;
    detail: string;
  }>;
  forecast: Array<{
    month: string;
    actual: number;
    predicted: number;
  }>;
  recommendations: Array<{
    title: string;
    detail: string;
    savings: string;
  }>;
};

export type HrEmployee = {
  id: string;
  name: string;
  department: string;
  role: string;
  manager: string;
  performanceScore: number;
  productivityScore: number;
  attritionRisk: number;
  salary?: number;
  status?: "active" | "on-leave" | "inactive";
  leaveBalance?: number;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
};

export type HrModule = {
  tenantId: string;
  overview: {
    headcount: number;
    attendanceRate: number;
    attritionRisk: number;
    payrollBurn: number;
  };
  employees: HrEmployee[];
  attendance: Array<{
    month: string;
    onsite: number;
    remote: number;
    absent: number;
  }>;
  payroll: Array<{
    group: string;
    monthlyCost: number;
  }>;
  recommendations: Array<{
    title: string;
    detail: string;
    priority: string;
  }>;
};

export type FinanceLedgerEntry = {
  id: string;
  account: string;
  amount: number;
  direction: string;
  counterparty: string;
  postedAt: string;
};

export type FinanceInvoice = {
  id: string;
  customer: string;
  status: string;
  amount: number;
  dueDate: string;
  taxRate?: number;
};

export type FinanceModule = {
  tenantId: string;
  overview: {
    revenue: number;
    expenses: number;
    margin: number;
    cashReserve: number;
  };
  ledger: FinanceLedgerEntry[];
  invoices: FinanceInvoice[];
  forecast: Array<{
    month: string;
    actual: number;
    predicted: number;
  }>;
  anomalies: Array<{
    id: string;
    title: string;
    detail: string;
  }>;
  recommendations: Array<{
    title: string;
    detail: string;
    impact: string;
  }>;
};

export type SalesLead = {
  id: string;
  company: string;
  stage: string;
  value: number;
  probability: number;
  owner: string;
};

export type SalesCustomer = {
  id: string;
  name: string;
  healthScore: number;
  renewalMonth: string;
  expansionPotential: string;
};

export type SalesOrder = {
  id?: string;
  month: string;
  booked: number;
  won: number;
};

export type SalesModule = {
  tenantId: string;
  overview: {
    pipelineValue: number;
    conversionRate: number;
    wonDeals: number;
    forecast: number;
  };
  pipeline: SalesLead[];
  customers: SalesCustomer[];
  orders: SalesOrder[];
  recommendations: Array<{
    title: string;
    detail: string;
    confidence: number;
  }>;
};

export type DashboardData = {
  tenant: string;
  generatedAt: string;
  scorecard: {
    growth: number;
    operations: number;
    financeHealth: number;
    workforceHealth: number;
  };
  inventory: InventoryModule;
  hr: HrModule;
  finance: FinanceModule;
  sales: SalesModule;
  intelligence: {
    insights: Insight[];
    confidence: number;
    operatingSignal: string;
  };
  notifications: Notification[];
  auditLogs: Array<{
    id: string;
    action: string;
    actor: string;
    module: string;
    detail: string;
    timestamp: string;
  }>;
};

export type ScenarioInput = {
  salesDelta: number;
  hiringDelta: number;
  spendDelta: number;
};

export type ScenarioResponse = {
  assumptions: ScenarioInput;
  projectedRevenue: number;
  projectedSalesForecast: number;
  projectedExpenses: number;
  projectedMargin: number;
  projectedHeadcount: number;
  recommendation: string;
};

export type CopilotResponse = {
  answer: string;
  suggestedFollowUps: string[];
  intent?: string;
  confidence?: number;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  actor: string;
  module: string;
  detail: string;
  timestamp: string;
  severity?: "info" | "warning" | "critical";
  subjectId?: string;
  subjectEmail?: string;
  ipAddress?: string;
};

export type EmployeeActivityAnalysis = {
  riskLevel: string;
  executiveSummary: string;
  activitySignal: string;
  securitySignal: string;
  recommendedActions: string[];
};

export type EmployeeControlProfile = {
  user: UserProfile;
  hrProfile: Record<string, unknown> | null;
  activity: AuditLogEntry[];
  analysis: EmployeeActivityAnalysis;
};

export type SecurityOverview = {
  lockedAccounts: number;
  suspendedAccounts: number;
  rotationRequired: number;
  adminCount: number;
  recentWarnings: AuditLogEntry[];
  analysis: {
    overallRisk: string;
    summary: string;
    findings: string[];
    recommendations: string[];
  };
};

export type AiWorkbench = {
  tools: Array<{
    id: string;
    title: string;
    summary: string;
    priority: string;
  }>;
  executiveBrief: {
    summary: string;
    recommendation: string;
  };
  supplyChain: {
    summary: string;
    recommendation: string;
  };
  workingCapital: {
    summary: string;
    recommendation: string;
  };
  workforce: {
    summary: string;
    recommendation: string;
  };
  revenue: {
    summary: string;
    recommendation: string;
  };
  security: {
    summary: string;
    recommendation: string;
  };
  supplierIntelligence: {
    summary: string;
    recommendation: string;
  };
  policyGuard: {
    summary: string;
    recommendation: string;
  };
  anomalyRadar: {
    summary: string;
    recommendation: string;
  };
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  title?: string;
  department?: string;
};
