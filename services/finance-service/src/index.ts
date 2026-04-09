import cors from "cors";
import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type LedgerEntry = {
  id: string;
  account: string;
  amount: number;
  direction: "credit" | "debit";
  counterparty: string;
  postedAt: string;
};

type Invoice = {
  id: string;
  customer: string;
  status: "draft" | "pending" | "paid" | "overdue";
  amount: number;
  dueDate: string;
  taxRate: number;
};

type FinanceState = {
  ledger: LedgerEntry[];
  invoices: Invoice[];
};

type FinanceStore = Record<string, FinanceState>;

const app = express();
const port = Number(process.env.PORT ?? 4103);
const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const stateFile = path.join(dataDirectory, "finance.json");
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

let store: FinanceStore = {};

app.use(cors());
app.use(express.json());

function seedState(): FinanceState {
  return {
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
      {
        id: "inv-1001",
        customer: "Helios Retail",
        status: "paid",
        amount: 126000,
        dueDate: "2026-04-08",
        taxRate: 18
      },
      {
        id: "inv-1002",
        customer: "Summit Logistics",
        status: "pending",
        amount: 92000,
        dueDate: "2026-04-12",
        taxRate: 18
      },
      {
        id: "inv-1003",
        customer: "Aurora Foods",
        status: "overdue",
        amount: 41800,
        dueDate: "2026-03-29",
        taxRate: 12
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
    store = JSON.parse(contents) as FinanceStore;
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

function formatInr(value: number) {
  return currencyFormatter.format(value);
}

function buildForecast(state: FinanceState) {
  const revenue = state.invoices
    .filter((invoice) => invoice.status === "paid" || invoice.status === "pending")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const expenses = state.ledger.filter((entry) => entry.direction === "debit").reduce((sum, entry) => sum + entry.amount, 0);
  const base = Math.max(1.2, (revenue - expenses / 2) / 100000);
  const months = ["Apr", "May", "Jun", "Jul"];

  return months.map((month, index) => ({
    month,
    actual: Number((base + index * 0.14).toFixed(2)),
    predicted: Number((base + index * 0.18 + 0.04).toFixed(2))
  }));
}

function buildAnomalies(state: FinanceState) {
  const overdue = state.invoices.filter((invoice) => invoice.status === "overdue");
  const largeDebits = state.ledger
    .filter((entry) => entry.direction === "debit")
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 2);

  return [
    ...overdue.map((invoice) => ({
      id: `anom-overdue-${invoice.id}`,
      title: `${invoice.customer} invoice is overdue`,
      detail: `${invoice.id} is overdue with ${formatInr(invoice.amount)} still outstanding.`
    })),
    ...largeDebits.map((entry) => ({
      id: `anom-ledger-${entry.id}`,
      title: `Large debit posted to ${entry.account}`,
      detail: `${entry.counterparty} triggered a ${formatInr(entry.amount)} debit on ${entry.postedAt}.`
    }))
  ].slice(0, 4);
}

function buildRecommendations(state: FinanceState) {
  const overdueValue = state.invoices
    .filter((invoice) => invoice.status === "overdue")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const pendingValue = state.invoices
    .filter((invoice) => invoice.status === "pending")
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  return [
    {
      title: "Accelerate collections",
      detail:
        overdueValue > 0
          ? `Overdue invoices worth ${formatInr(overdueValue)} should be escalated this week.`
          : "Collections are healthy and there are no overdue invoices to chase.",
      impact: `₹${Math.max(40, Math.round((overdueValue + pendingValue) / 85_000)).toLocaleString()} lakh cash-flow opportunity`
    },
    {
      title: "Review major debits",
      detail: "Compare recent ledger debits against approved budgets before the next close cycle.",
      impact: "₹78 lakh quarterly margin protection"
    }
  ];
}

function buildSnapshot(tenantId: string) {
  const state = getTenantState(tenantId);
  const paidInvoiceRevenue = state.invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const creditLedgerRevenue = state.ledger
    .filter((entry) => entry.direction === "credit")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const debitExpenses = state.ledger
    .filter((entry) => entry.direction === "debit")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const revenue = paidInvoiceRevenue + creditLedgerRevenue;
  const expenses = debitExpenses;
  const margin = revenue > 0 ? Number((((revenue - expenses) / revenue) * 100).toFixed(1)) : 0;
  const cashReserve = Math.max(150000, 520000 + revenue - expenses);

  return {
    tenantId,
    overview: {
      revenue,
      expenses,
      margin,
      cashReserve
    },
    ledger: [...state.ledger].sort((left, right) => right.postedAt.localeCompare(left.postedAt)),
    invoices: [...state.invoices].sort((left, right) => right.dueDate.localeCompare(left.dueDate)),
    forecast: buildForecast(state),
    anomalies: buildAnomalies(state),
    recommendations: buildRecommendations(state)
  };
}

app.get("/", (_req, res) => {
  res.json({
    name: "finance-service",
    status: "ok",
    docs: {
      health: "/health",
      overview: "/api/finance/overview",
      invoices: "/api/finance/invoices",
      ledger: "/api/finance/ledger"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "finance-service" });
});

app.get("/api/finance/overview", (req, res) => {
  res.json(buildSnapshot(getTenantId(req)));
});

app.get("/api/finance/invoices", (req, res) => {
  const state = getTenantState(getTenantId(req));
  res.json([...state.invoices].sort((left, right) => right.dueDate.localeCompare(left.dueDate)));
});

app.post("/api/finance/invoices", async (req, res) => {
  const state = getTenantState(getTenantId(req));
  const { customer, amount, dueDate, taxRate, status } = req.body as Partial<Invoice>;

  if (!customer || !dueDate) {
    res.status(400).json({ message: "Customer and due date are required." });
    return;
  }

  const numericAmount = Number(amount ?? 0);
  const numericTaxRate = Number(taxRate ?? 18);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !Number.isFinite(numericTaxRate)) {
    res.status(400).json({ message: "Amount and tax rate must be valid numbers." });
    return;
  }

  const invoice: Invoice = {
    id: `inv-${String(state.invoices.length + 1001).padStart(4, "0")}`,
    customer,
    amount: Math.round(numericAmount),
    dueDate,
    taxRate: Math.round(numericTaxRate),
    status: status === "draft" || status === "paid" || status === "overdue" ? status : "pending"
  };

  state.invoices.unshift(invoice);
  await persistStore();
  res.status(201).json(invoice);
});

app.patch("/api/finance/invoices/:id", async (req, res) => {
  const state = getTenantState(getTenantId(req));
  const invoice = state.invoices.find((entry) => entry.id === req.params.id);

  if (!invoice) {
    res.status(404).json({ message: "Invoice not found." });
    return;
  }

  if (typeof req.body?.customer === "string") {
    invoice.customer = req.body.customer;
  }
  if (typeof req.body?.dueDate === "string") {
    invoice.dueDate = req.body.dueDate;
  }

  if (req.body?.status === "draft" || req.body?.status === "pending" || req.body?.status === "paid" || req.body?.status === "overdue") {
    invoice.status = req.body.status;
  }

  if (req.body?.amount !== undefined) {
    const numericAmount = Number(req.body.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ message: "Amount must be a valid number." });
      return;
    }
    invoice.amount = Math.round(numericAmount);
  }

  if (req.body?.taxRate !== undefined) {
    const numericTaxRate = Number(req.body.taxRate);
    if (!Number.isFinite(numericTaxRate)) {
      res.status(400).json({ message: "Tax rate must be a valid number." });
      return;
    }
    invoice.taxRate = Math.round(numericTaxRate);
  }

  await persistStore();
  res.json(invoice);
});

app.get("/api/finance/ledger", (req, res) => {
  const state = getTenantState(getTenantId(req));
  res.json([...state.ledger].sort((left, right) => right.postedAt.localeCompare(left.postedAt)));
});

app.post("/api/finance/ledger", async (req, res) => {
  const state = getTenantState(getTenantId(req));
  const {
    account,
    amount,
    direction,
    counterparty,
    postedAt
  } = req.body as Partial<LedgerEntry>;

  if (!account || !counterparty || !postedAt || (direction !== "credit" && direction !== "debit")) {
    res.status(400).json({ message: "Account, counterparty, date, and direction are required." });
    return;
  }

  const numericAmount = Number(amount ?? 0);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    res.status(400).json({ message: "Amount must be a valid positive number." });
    return;
  }

  const ledgerEntry: LedgerEntry = {
    id: `led-${randomUUID()}`,
    account,
    amount: Math.round(numericAmount),
    direction,
    counterparty,
    postedAt
  };

  state.ledger.unshift(ledgerEntry);
  await persistStore();
  res.status(201).json(ledgerEntry);
});

void loadStore().then(() => {
  app.listen(port, () => {
    console.log(`Finance service listening on http://localhost:${port}`);
  });
});
