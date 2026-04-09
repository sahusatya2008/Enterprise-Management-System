import type {
  CopilotResponse,
  DashboardData,
  FinanceModule,
  HrModule,
  InventoryModule,
  ModuleName,
  SalesModule,
  ScenarioInput,
  ScenarioResponse
} from "@/types/erp";

export const inventoryFallback: InventoryModule = {
  tenantId: "northstar-holdings",
  overview: {
    totalSkus: 1248,
    stockUnits: 48620,
    warehouses: 4,
    lowStockItems: 14,
    fulfillmentRate: 97.2
  },
  products: [
    {
      id: "prd-101",
      sku: "ALP-IND-01",
      name: "Industrial Sensor Kit",
      category: "Industrial IoT",
      supplier: "Atlas Components",
      warehouse: "Mumbai Central",
      stock: 42,
      reorderPoint: 55,
      unitCost: 480,
      trend: "+18%"
    },
    {
      id: "prd-102",
      sku: "ALP-CNC-07",
      name: "CNC Spindle Controller",
      category: "Manufacturing",
      supplier: "Machina Works",
      warehouse: "Pune North",
      stock: 16,
      reorderPoint: 24,
      unitCost: 920,
      trend: "+11%"
    },
    {
      id: "prd-103",
      sku: "ALP-RET-18",
      name: "Retail Edge Gateway",
      category: "Retail Tech",
      supplier: "Blue Circuit",
      warehouse: "Delhi Prime",
      stock: 68,
      reorderPoint: 40,
      unitCost: 210,
      trend: "+24%"
    },
    {
      id: "prd-104",
      sku: "ALP-LOG-31",
      name: "Logistics Beacon Pack",
      category: "Logistics",
      supplier: "CargoSense",
      warehouse: "Chennai South",
      stock: 11,
      reorderPoint: 18,
      unitCost: 135,
      trend: "+29%"
    }
  ],
  warehouses: [
    { id: "wh-1", name: "Mumbai Central", utilization: 82, outboundToday: 320, inboundToday: 180 },
    { id: "wh-2", name: "Pune North", utilization: 74, outboundToday: 210, inboundToday: 154 },
    { id: "wh-3", name: "Delhi Prime", utilization: 69, outboundToday: 268, inboundToday: 233 },
    { id: "wh-4", name: "Chennai South", utilization: 88, outboundToday: 192, inboundToday: 141 }
  ],
  alerts: [
    {
      id: "alt-1",
      severity: "high",
      title: "Safety stock breached for Spindle Controller",
      detail: "Projected to stock out in 5 days at the current run rate."
    },
    {
      id: "alt-2",
      severity: "medium",
      title: "Demand spike in logistics beacon packs",
      detail: "Weekly orders are 27% above the trailing 6-week average."
    }
  ],
  forecast: [
    { month: "Jan", actual: 410, predicted: 425 },
    { month: "Feb", actual: 438, predicted: 449 },
    { month: "Mar", actual: 462, predicted: 470 },
    { month: "Apr", actual: 479, predicted: 491 },
    { month: "May", actual: 512, predicted: 528 },
    { month: "Jun", actual: 536, predicted: 548 }
  ],
  recommendations: [
    {
      title: "Bundle replenishment by supplier lane",
      detail: "Merge two Pune purchase orders and prioritize Machina Works for the next 10-day window.",
      savings: "₹15.1 lakh logistics cost avoidance"
    },
    {
      title: "Advance reorder window on logistics SKUs",
      detail: "Move reorder lead time from 9 to 13 days for beacon packs to protect service levels.",
      savings: "4.3 pts higher fulfillment resilience"
    }
  ]
};

export const hrFallback: HrModule = {
  tenantId: "northstar-holdings",
  overview: {
    headcount: 286,
    attendanceRate: 95.8,
    attritionRisk: 13.6,
    payrollBurn: 384000
  },
  employees: [
    {
      id: "emp-1",
      name: "Riya Shah",
      department: "Business Operations",
      role: "Senior Analyst",
      manager: "Jordan Lee",
      performanceScore: 92,
      productivityScore: 88,
      attritionRisk: 11
    },
    {
      id: "emp-2",
      name: "Arjun Patel",
      department: "Sales",
      role: "Account Executive",
      manager: "Nina Chen",
      performanceScore: 86,
      productivityScore: 84,
      attritionRisk: 19
    },
    {
      id: "emp-3",
      name: "Priya Nair",
      department: "Finance",
      role: "Controller",
      manager: "Avery Morgan",
      performanceScore: 90,
      productivityScore: 89,
      attritionRisk: 8
    },
    {
      id: "emp-4",
      name: "Omar Hassan",
      department: "Inventory",
      role: "Warehouse Lead",
      manager: "Jordan Lee",
      performanceScore: 79,
      productivityScore: 77,
      attritionRisk: 16
    }
  ],
  attendance: [
    { month: "Jan", onsite: 91, remote: 6, absent: 3 },
    { month: "Feb", onsite: 90, remote: 7, absent: 3 },
    { month: "Mar", onsite: 92, remote: 5, absent: 3 },
    { month: "Apr", onsite: 91, remote: 6, absent: 3 }
  ],
  payroll: [
    { group: "Operations", monthlyCost: 122000 },
    { group: "Sales", monthlyCost: 108000 },
    { group: "Finance", monthlyCost: 86000 },
    { group: "Engineering", monthlyCost: 68000 }
  ],
  recommendations: [
    {
      title: "Open 6 operations roles in advance of pipeline surge",
      detail: "Sales coverage indicates fulfillment pressure in the next 45 days.",
      priority: "high"
    },
    {
      title: "Retention sprint for commercial teams",
      detail: "Attrition risk is concentrated in high-performing account executives and sales ops coordinators.",
      priority: "medium"
    }
  ]
};

export const financeFallback: FinanceModule = {
  tenantId: "northstar-holdings",
  overview: {
    revenue: 2860000,
    expenses: 2210000,
    margin: 22.7,
    cashReserve: 980000
  },
  ledger: [
    {
      id: "led-1",
      account: "Subscription Revenue",
      amount: 182000,
      direction: "credit",
      counterparty: "Helios Retail",
      postedAt: "2026-04-01"
    },
    {
      id: "led-2",
      account: "Vendor Payments",
      amount: 94000,
      direction: "debit",
      counterparty: "Machina Works",
      postedAt: "2026-04-02"
    },
    {
      id: "led-3",
      account: "Payroll",
      amount: 384000,
      direction: "debit",
      counterparty: "Northstar Payroll",
      postedAt: "2026-04-03"
    }
  ],
  invoices: [
    { id: "inv-1001", customer: "Helios Retail", status: "paid", amount: 126000, dueDate: "2026-04-08" },
    { id: "inv-1002", customer: "Summit Logistics", status: "pending", amount: 92000, dueDate: "2026-04-12" },
    { id: "inv-1003", customer: "Aurora Foods", status: "overdue", amount: 41800, dueDate: "2026-03-29" }
  ],
  forecast: [
    { month: "Apr", actual: 2.82, predicted: 2.86 },
    { month: "May", actual: 2.91, predicted: 2.99 },
    { month: "Jun", actual: 3.02, predicted: 3.11 },
    { month: "Jul", actual: 3.16, predicted: 3.24 }
  ],
  anomalies: [
    { id: "anom-1", title: "Freight surcharge variance", detail: "Carrier spend is 14% above plan in the South region." }
  ],
  recommendations: [
    {
      title: "Shift 8% of discretionary spend to supplier automation",
      detail: "This offsets margin pressure without reducing customer-facing capacity.",
      impact: "₹78.0 lakh quarterly margin protection"
    },
    {
      title: "Escalate 3 overdue invoices through CX finance pod",
      detail: "Fast collection improves working capital ahead of the next procurement cycle.",
      impact: "₹1.14 crore cash unlocked"
    }
  ]
};

export const salesFallback: SalesModule = {
  tenantId: "northstar-holdings",
  overview: {
    pipelineValue: 1840000,
    conversionRate: 31.8,
    wonDeals: 46,
    forecast: 3320000
  },
  pipeline: [
    { id: "lead-1", company: "Helios Retail", stage: "Negotiation", value: 340000, probability: 74, owner: "Nina Chen" },
    { id: "lead-2", company: "Summit Logistics", stage: "Proposal", value: 260000, probability: 61, owner: "Aditya Rao" },
    { id: "lead-3", company: "Aurora Foods", stage: "Discovery", value: 118000, probability: 33, owner: "Maya Singh" }
  ],
  customers: [
    { id: "cus-1", name: "Helios Retail", healthScore: 91, renewalMonth: "June", expansionPotential: "high" },
    { id: "cus-2", name: "Summit Logistics", healthScore: 84, renewalMonth: "September", expansionPotential: "medium" }
  ],
  orders: [
    { month: "Jan", booked: 1.9, won: 1.2 },
    { month: "Feb", booked: 2.1, won: 1.4 },
    { month: "Mar", booked: 2.4, won: 1.5 },
    { month: "Apr", booked: 2.7, won: 1.7 }
  ],
  recommendations: [
    {
      title: "Double down on logistics vertical",
      detail: "Pipeline growth and win rates are strongest in fulfillment-heavy accounts.",
      confidence: 0.86
    },
    {
      title: "Protect top AE capacity with sales-ops support",
      detail: "High-value opportunities depend on timely proposals and pricing turnarounds.",
      confidence: 0.81
    }
  ]
};

export const dashboardFallback: DashboardData = {
  tenant: "northstar-holdings",
  generatedAt: "2026-04-07T10:30:00.000Z",
  scorecard: {
    growth: 42.9,
    operations: 89.4,
    financeHealth: 98,
    workforceHealth: 90.3
  },
  inventory: inventoryFallback,
  hr: hrFallback,
  finance: financeFallback,
  sales: salesFallback,
  intelligence: {
    confidence: 0.86,
    operatingSignal: "growth-constrained",
    insights: [
      {
        title: "Scale workforce with revenue momentum",
        summary: "Sales pipeline strength is outpacing current fulfillment and sales-ops capacity.",
        owner: "HR + Sales",
        impact: "Open roles in operations and proposal support before the next 45-day demand wave.",
        confidence: 0.86
      },
      {
        title: "Protect service levels through supplier prioritization",
        summary: "Inventory health is tightening in high-growth product lanes.",
        owner: "Inventory",
        impact: "Accelerate replenishment from priority suppliers and rebalance safety stock across warehouses.",
        confidence: 0.84
      },
      {
        title: "Improve margin through focused cost takeout",
        summary: "Finance signals show room to reduce freight and discretionary spend before margin slips further.",
        owner: "Finance",
        impact: "Redirect non-critical spend toward automation and collections workflows.",
        confidence: 0.8
      }
    ]
  },
  notifications: [
    {
      id: "notif-low-stock",
      title: "Low stock cluster detected",
      severity: "high",
      module: "inventory",
      detail: "14 SKUs are under their reorder point across active warehouses.",
      createdAt: "2026-04-07T10:31:00.000Z"
    },
    {
      id: "notif-attrition",
      title: "Attrition pulse trending upward",
      severity: "medium",
      module: "hr",
      detail: "Attrition exposure is 13.6% and needs retention action in Sales Ops.",
      createdAt: "2026-04-07T10:26:00.000Z"
    },
    {
      id: "notif-margin",
      title: "Margin compression watch",
      severity: "medium",
      module: "finance",
      detail: "Net margin is 22.7% while discretionary spend remains elevated.",
      createdAt: "2026-04-07T10:22:00.000Z"
    }
  ],
  auditLogs: [
    {
      id: "audit-100",
      action: "SYSTEM_BOOT",
      actor: "platform",
      module: "core",
      detail: "ERP control plane initialized with live module adapters.",
      timestamp: "2026-04-07T10:18:00.000Z"
    },
    {
      id: "audit-101",
      action: "VIEW_DASHBOARD",
      actor: "admin@northstar.com",
      module: "executive",
      detail: "Executive cockpit snapshot loaded.",
      timestamp: "2026-04-07T10:31:00.000Z"
    }
  ]
};

export const moduleFallbacks: Record<ModuleName, InventoryModule | HrModule | FinanceModule | SalesModule> = {
  inventory: inventoryFallback,
  hr: hrFallback,
  finance: financeFallback,
  sales: salesFallback
};

export function fallbackScenario(input: ScenarioInput): ScenarioResponse {
  const projectedRevenue = financeFallback.overview.revenue * (1 + input.salesDelta / 100);
  const projectedExpenses =
    financeFallback.overview.expenses * (1 + input.spendDelta / 100) +
    hrFallback.overview.headcount * 2200 * (input.hiringDelta / 100);
  const projectedMargin = ((projectedRevenue - projectedExpenses) / projectedRevenue) * 100;

  return {
    assumptions: input,
    projectedRevenue: Number(projectedRevenue.toFixed(2)),
    projectedSalesForecast: Number((salesFallback.overview.forecast * (1 + input.salesDelta / 100)).toFixed(2)),
    projectedExpenses: Number(projectedExpenses.toFixed(2)),
    projectedMargin: Number(projectedMargin.toFixed(2)),
    projectedHeadcount: Math.round(hrFallback.overview.headcount * (1 + input.hiringDelta / 100)),
    recommendation:
      projectedMargin > 20
        ? "Increase hiring gradually and prioritize proposal support roles."
        : "Reduce discretionary spend and protect top-performing teams before expanding."
  };
}

export function fallbackCopilot(question: string): CopilotResponse {
  const normalized = question.toLowerCase();

  if (normalized.includes("hire") || normalized.includes("headcount")) {
    return {
      answer:
        "Open operations planning and sales-ops roles first. The commercial pipeline is rising faster than fulfillment capacity.",
      suggestedFollowUps: [
        "Which teams are at highest attrition risk?",
        "How many roles should we open this quarter?",
        "What if sales soften after hiring?"
      ]
    };
  }

  if (normalized.includes("inventory") || normalized.includes("stock")) {
    return {
      answer:
        "Inventory should focus on the logistics and manufacturing lanes where demand is rising and low-stock exposure is already visible.",
      suggestedFollowUps: [
        "Which SKUs need urgent restocking?",
        "What supplier should we prioritize?",
        "How does inventory affect our forecast?"
      ]
    };
  }

  return {
    answer:
      "Growth is healthy, but the best next move is coordinated: hire selectively, raise replenishment coverage, and trim freight-heavy spend.",
    suggestedFollowUps: [
      "What happens if sales drop 20%?",
      "Where can we cut costs without hurting growth?",
      "What is our current margin risk?"
    ]
  };
}
