import cors from "cors";
import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Employee = {
  id: string;
  name: string;
  department: string;
  role: string;
  manager: string;
  performanceScore: number;
  productivityScore: number;
  attritionRisk: number;
  salary: number;
  status: "active" | "on-leave" | "inactive";
  leaveBalance: number;
};

type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
};

type HrState = {
  employees: Employee[];
  leaveRequests: LeaveRequest[];
};

type HrStore = Record<string, HrState>;

const app = express();
const port = Number(process.env.PORT ?? 4102);
const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const stateFile = path.join(dataDirectory, "hr.json");

let store: HrStore = {};

app.use(cors());
app.use(express.json());

function seedState(): HrState {
  return {
    employees: [
      {
        id: "emp-1",
        name: "Riya Shah",
        department: "Business Operations",
        role: "Senior Analyst",
        manager: "Jordan Lee",
        performanceScore: 92,
        productivityScore: 88,
        attritionRisk: 11,
        salary: 168000,
        status: "active",
        leaveBalance: 14
      },
      {
        id: "emp-2",
        name: "Arjun Patel",
        department: "Sales",
        role: "Account Executive",
        manager: "Nina Chen",
        performanceScore: 86,
        productivityScore: 84,
        attritionRisk: 19,
        salary: 142000,
        status: "active",
        leaveBalance: 10
      },
      {
        id: "emp-3",
        name: "Priya Nair",
        department: "Finance",
        role: "Controller",
        manager: "Avery Morgan",
        performanceScore: 90,
        productivityScore: 89,
        attritionRisk: 8,
        salary: 176000,
        status: "active",
        leaveBalance: 11
      },
      {
        id: "emp-4",
        name: "Omar Hassan",
        department: "Inventory",
        role: "Warehouse Lead",
        manager: "Jordan Lee",
        performanceScore: 79,
        productivityScore: 77,
        attritionRisk: 16,
        salary: 126000,
        status: "on-leave",
        leaveBalance: 7
      }
    ],
    leaveRequests: [
      {
        id: "leave-1",
        employeeId: "emp-4",
        employeeName: "Omar Hassan",
        department: "Inventory",
        startDate: "2026-04-08",
        endDate: "2026-04-11",
        reason: "Planned personal leave",
        status: "approved"
      }
    ]
  };
}

async function persistStore() {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(stateFile, JSON.stringify(store, null, 2), "utf8");
}

async function loadStore() {
  await mkdir(dataDirectory, { recursive: true });

  try {
    const contents = await readFile(stateFile, "utf8");
    store = JSON.parse(contents) as HrStore;
  } catch {
    store = {
      "northstar-holdings": seedState()
    };
    await persistStore();
  }
}

function getTenantId(req: Request) {
  return typeof req.headers["x-tenant-id"] === "string" ? req.headers["x-tenant-id"] : "northstar-holdings";
}

function getTenantState(tenantId: string) {
  if (!store[tenantId]) {
    store[tenantId] = seedState();
    void persistStore();
  }

  return store[tenantId];
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildAttendance(state: HrState) {
  const activeEmployees = state.employees.filter((employee) => employee.status !== "inactive");
  const avgProductivity = average(activeEmployees.map((employee) => employee.productivityScore));
  const avgAttendance = Math.max(84, Math.min(99, avgProductivity + 8));
  const months = ["Jan", "Feb", "Mar", "Apr"];

  return months.map((month, index) => {
    const onsite = Math.max(70, Math.round(avgAttendance - 3 + index));
    const remote = Math.max(2, Math.round(100 - onsite - 3));

    return {
      month,
      onsite,
      remote,
      absent: Math.max(1, 100 - onsite - remote)
    };
  });
}

function buildPayroll(state: HrState) {
  const totals = new Map<string, number>();

  for (const employee of state.employees) {
    if (employee.status === "inactive") {
      continue;
    }

    totals.set(employee.department, (totals.get(employee.department) ?? 0) + employee.salary / 12);
  }

  return [...totals.entries()]
    .map(([group, monthlyCost]) => ({
      group,
      monthlyCost: Math.round(monthlyCost)
    }))
    .sort((left, right) => right.monthlyCost - left.monthlyCost);
}

function buildRecommendations(state: HrState) {
  const highestRisk = [...state.employees].sort((left, right) => right.attritionRisk - left.attritionRisk)[0];
  const pendingLeaves = state.leaveRequests.filter((request) => request.status === "pending").length;

  return [
    {
      title: "Review retention plan for at-risk talent",
      detail: highestRisk
        ? `${highestRisk.name} has the highest attrition risk in ${highestRisk.department}. Schedule a manager follow-up this week.`
        : "Attrition exposure is healthy across the workforce.",
      priority: "high"
    },
    {
      title: "Clear pending leave queue",
      detail:
        pendingLeaves > 0
          ? `${pendingLeaves} leave request${pendingLeaves === 1 ? "" : "s"} await manager approval.`
          : "Leave approvals are current and no pending requests remain.",
      priority: pendingLeaves > 0 ? "medium" : "low"
    }
  ];
}

function buildSnapshot(tenantId: string) {
  const state = getTenantState(tenantId);
  const activeEmployees = state.employees.filter((employee) => employee.status !== "inactive");
  const payrollBurn = Math.round(activeEmployees.reduce((sum, employee) => sum + employee.salary / 12, 0));
  const attendanceRate = Number(Math.max(82, Math.min(98, average(activeEmployees.map((employee) => employee.productivityScore)) + 8)).toFixed(1));
  const attritionRisk = Number(average(activeEmployees.map((employee) => employee.attritionRisk)).toFixed(1));

  return {
    tenantId,
    overview: {
      headcount: activeEmployees.length,
      attendanceRate,
      attritionRisk,
      payrollBurn
    },
    employees: [...state.employees].sort((left, right) => left.name.localeCompare(right.name)),
    attendance: buildAttendance(state),
    payroll: buildPayroll(state),
    recommendations: buildRecommendations(state)
  };
}

app.get("/", (_req, res) => {
  res.json({
    name: "hr-service",
    status: "ok",
    docs: {
      health: "/health",
      overview: "/api/hr/overview",
      employees: "/api/hr/employees",
      leaveRequests: "/api/hr/leave-requests"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "hr-service" });
});

app.get("/api/hr/overview", (req, res) => {
  res.json(buildSnapshot(getTenantId(req)));
});

app.get("/api/hr/employees", (req, res) => {
  const state = getTenantState(getTenantId(req));
  res.json([...state.employees].sort((left, right) => left.name.localeCompare(right.name)));
});

app.post("/api/hr/employees", async (req, res) => {
  const state = getTenantState(getTenantId(req));
  const {
    name,
    department,
    role,
    manager,
    salary,
    performanceScore,
    productivityScore,
    attritionRisk,
    status,
    leaveBalance
  } = req.body as Partial<Employee>;

  if (!name || !department || !role || !manager) {
    res.status(400).json({ message: "Name, department, role, and manager are required." });
    return;
  }

  const numericSalary = Number(salary ?? 0);
  if (!Number.isFinite(numericSalary) || numericSalary <= 0) {
    res.status(400).json({ message: "A valid annual salary is required." });
    return;
  }

  const employee: Employee = {
    id: `emp-${randomUUID()}`,
    name,
    department,
    role,
    manager,
    performanceScore: Number.isFinite(Number(performanceScore)) ? Math.round(Number(performanceScore)) : 80,
    productivityScore: Number.isFinite(Number(productivityScore)) ? Math.round(Number(productivityScore)) : 78,
    attritionRisk: Number.isFinite(Number(attritionRisk)) ? Math.round(Number(attritionRisk)) : 12,
    salary: Math.round(numericSalary),
    status: status === "inactive" || status === "on-leave" ? status : "active",
    leaveBalance: Number.isFinite(Number(leaveBalance)) ? Math.round(Number(leaveBalance)) : 12
  };

  state.employees.unshift(employee);
  await persistStore();
  res.status(201).json(employee);
});

app.patch("/api/hr/employees/:id", async (req, res) => {
  const state = getTenantState(getTenantId(req));
  const employee = state.employees.find((entry) => entry.id === req.params.id);

  if (!employee) {
    res.status(404).json({ message: "Employee not found." });
    return;
  }

  if (typeof req.body?.name === "string") {
    employee.name = req.body.name;
  }
  if (typeof req.body?.department === "string") {
    employee.department = req.body.department;
  }
  if (typeof req.body?.role === "string") {
    employee.role = req.body.role;
  }
  if (typeof req.body?.manager === "string") {
    employee.manager = req.body.manager;
  }

  const numericFields = [
    ["performanceScore", req.body?.performanceScore],
    ["productivityScore", req.body?.productivityScore],
    ["attritionRisk", req.body?.attritionRisk],
    ["salary", req.body?.salary],
    ["leaveBalance", req.body?.leaveBalance]
  ] as const;

  for (const [field, value] of numericFields) {
    if (value === undefined) {
      continue;
    }

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
      res.status(400).json({ message: `${field} must be a valid number.` });
      return;
    }

    employee[field] = Math.round(parsedValue) as never;
  }

  if (req.body?.status === "active" || req.body?.status === "on-leave" || req.body?.status === "inactive") {
    employee.status = req.body.status;
  }

  await persistStore();
  res.json(employee);
});

app.get("/api/hr/leave-requests", (req, res) => {
  const state = getTenantState(getTenantId(req));
  res.json([...state.leaveRequests].sort((left, right) => right.startDate.localeCompare(left.startDate)));
});

app.post("/api/hr/leave-requests", async (req, res) => {
  const state = getTenantState(getTenantId(req));
  const {
    employeeId,
    startDate,
    endDate,
    reason
  } = req.body as {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
  };

  if (!employeeId || !startDate || !endDate || !reason) {
    res.status(400).json({ message: "Employee, date range, and reason are required." });
    return;
  }

  const employee = state.employees.find((entry) => entry.id === employeeId);
  if (!employee) {
    res.status(404).json({ message: "Employee not found." });
    return;
  }

  const leaveRequest: LeaveRequest = {
    id: `leave-${randomUUID()}`,
    employeeId: employee.id,
    employeeName: employee.name,
    department: employee.department,
    startDate,
    endDate,
    reason,
    status: "pending"
  };

  state.leaveRequests.unshift(leaveRequest);
  await persistStore();
  res.status(201).json(leaveRequest);
});

app.patch("/api/hr/leave-requests/:id", async (req, res) => {
  const state = getTenantState(getTenantId(req));
  const leaveRequest = state.leaveRequests.find((entry) => entry.id === req.params.id);

  if (!leaveRequest) {
    res.status(404).json({ message: "Leave request not found." });
    return;
  }

  if (req.body?.status !== "pending" && req.body?.status !== "approved" && req.body?.status !== "rejected") {
    res.status(400).json({ message: "A valid leave request status is required." });
    return;
  }

  leaveRequest.status = req.body.status;
  const employee = state.employees.find((entry) => entry.id === leaveRequest.employeeId);
  if (employee) {
    employee.status = leaveRequest.status === "approved" ? "on-leave" : "active";
  }

  await persistStore();
  res.json(leaveRequest);
});

void loadStore().then(() => {
  app.listen(port, () => {
    console.log(`HR service listening on http://localhost:${port}`);
  });
});
