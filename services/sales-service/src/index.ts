import cors from "cors";
import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Lead = {
  id: string;
  company: string;
  stage: string;
  value: number;
  probability: number;
  owner: string;
};

type Customer = {
  id: string;
  name: string;
  healthScore: number;
  renewalMonth: string;
  expansionPotential: string;
};

type Order = {
  id: string;
  month: string;
  booked: number;
  won: number;
};

type SalesState = {
  leads: Lead[];
  customers: Customer[];
  orders: Order[];
};

type SalesStore = Record<string, SalesState>;

const app = express();
const port = Number(process.env.PORT ?? 4104);
const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const stateFile = path.join(dataDirectory, "sales.json");

let store: SalesStore = {};

app.use(cors());
app.use(express.json());

function seedState(): SalesState {
  return {
    leads: [
      {
        id: "lead-1",
        company: "Helios Retail",
        stage: "Negotiation",
        value: 340000,
        probability: 74,
        owner: "Nina Chen"
      },
      {
        id: "lead-2",
        company: "Summit Logistics",
        stage: "Proposal",
        value: 260000,
        probability: 61,
        owner: "Aditya Rao"
      },
      {
        id: "lead-3",
        company: "Aurora Foods",
        stage: "Discovery",
        value: 118000,
        probability: 33,
        owner: "Maya Singh"
      }
    ],
    customers: [
      {
        id: "cus-1",
        name: "Helios Retail",
        healthScore: 91,
        renewalMonth: "June",
        expansionPotential: "high"
      },
      {
        id: "cus-2",
        name: "Summit Logistics",
        healthScore: 84,
        renewalMonth: "September",
        expansionPotential: "medium"
      }
    ],
    orders: [
      { id: "ord-1", month: "Jan", booked: 1.9, won: 1.2 },
      { id: "ord-2", month: "Feb", booked: 2.1, won: 1.4 },
      { id: "ord-3", month: "Mar", booked: 2.4, won: 1.5 },
      { id: "ord-4", month: "Apr", booked: 2.7, won: 1.7 }
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
    store = JSON.parse(contents) as SalesStore;
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

function buildRecommendations(state: SalesState) {
  const hottestLead = [...state.leads].sort((left, right) => right.probability - left.probability)[0];
  const atRiskCustomers = state.customers.filter((customer) => customer.healthScore < 80).length;

  return [
    {
      title: "Focus manager support on late-stage deals",
      detail: hottestLead
        ? `${hottestLead.company} is the strongest near-term opportunity and should receive executive sponsorship.`
        : "Pipeline is empty and needs fresh demand generation.",
      confidence: 0.88
    },
    {
      title: "Stabilize account health",
      detail:
        atRiskCustomers > 0
          ? `${atRiskCustomers} customer account${atRiskCustomers === 1 ? "" : "s"} need retention outreach before renewal.`
          : "Customer health is stable across the CRM portfolio.",
      confidence: 0.8
    }
  ];
}

function buildSnapshot(tenantId: string) {
  const state = getTenantState(tenantId);
  const openPipeline = state.leads.filter((lead) => !lead.stage.toLowerCase().includes("closed"));
  const pipelineValue = openPipeline.reduce((sum, lead) => sum + lead.value, 0);
  const wonDeals = state.leads.filter((lead) => lead.stage.toLowerCase() === "closed won").length;
  const conversionRate = state.leads.length > 0 ? Number(((wonDeals / state.leads.length) * 100).toFixed(1)) : 0;
  const forecast = Math.round(
    openPipeline.reduce((sum, lead) => sum + lead.value * (lead.probability / 100), 0) +
      state.leads.filter((lead) => lead.stage.toLowerCase() === "closed won").reduce((sum, lead) => sum + lead.value, 0)
  );

  return {
    tenantId,
    overview: {
      pipelineValue,
      conversionRate,
      wonDeals,
      forecast
    },
    pipeline: [...state.leads].sort((left, right) => right.value - left.value),
    customers: [...state.customers].sort((left, right) => right.healthScore - left.healthScore),
    orders: [...state.orders].sort((left, right) => left.month.localeCompare(right.month)),
    recommendations: buildRecommendations(state)
  };
}

app.get("/", (_req, res) => {
  res.json({
    name: "sales-service",
    status: "ok",
    docs: {
      health: "/health",
      overview: "/api/sales/overview",
      leads: "/api/sales/leads",
      customers: "/api/sales/customers",
      orders: "/api/sales/orders"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "sales-service" });
});

app.get("/api/sales/overview", (req, res) => {
  res.json(buildSnapshot(getTenantId(req)));
});

app.get("/api/sales/leads", (req, res) => {
  const state = getTenantState(getTenantId(req));
  res.json([...state.leads].sort((left, right) => right.value - left.value));
});

app.post("/api/sales/leads", async (req, res) => {
  const state = getTenantState(getTenantId(req));
  const { company, stage, value, probability, owner } = req.body as Partial<Lead>;

  if (!company || !stage || !owner) {
    res.status(400).json({ message: "Company, stage, and owner are required." });
    return;
  }

  const numericValue = Number(value ?? 0);
  const numericProbability = Number(probability ?? 0);
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericProbability)) {
    res.status(400).json({ message: "Value and probability must be valid numbers." });
    return;
  }

  const lead: Lead = {
    id: `lead-${randomUUID()}`,
    company,
    stage,
    value: Math.round(numericValue),
    probability: Math.max(0, Math.min(100, Math.round(numericProbability))),
    owner
  };

  state.leads.unshift(lead);
  await persistStore();
  res.status(201).json(lead);
});

app.patch("/api/sales/leads/:id", async (req, res) => {
  const state = getTenantState(getTenantId(req));
  const lead = state.leads.find((entry) => entry.id === req.params.id);

  if (!lead) {
    res.status(404).json({ message: "Lead not found." });
    return;
  }

  if (typeof req.body?.company === "string") {
    lead.company = req.body.company;
  }
  if (typeof req.body?.stage === "string") {
    lead.stage = req.body.stage;
  }
  if (typeof req.body?.owner === "string") {
    lead.owner = req.body.owner;
  }

  if (req.body?.value !== undefined) {
    const numericValue = Number(req.body.value);
    if (!Number.isFinite(numericValue)) {
      res.status(400).json({ message: "Value must be a valid number." });
      return;
    }
    lead.value = Math.round(numericValue);
  }

  if (req.body?.probability !== undefined) {
    const numericProbability = Number(req.body.probability);
    if (!Number.isFinite(numericProbability)) {
      res.status(400).json({ message: "Probability must be a valid number." });
      return;
    }
    lead.probability = Math.max(0, Math.min(100, Math.round(numericProbability)));
  }

  await persistStore();
  res.json(lead);
});

app.get("/api/sales/customers", (req, res) => {
  const state = getTenantState(getTenantId(req));
  res.json([...state.customers].sort((left, right) => right.healthScore - left.healthScore));
});

app.post("/api/sales/customers", async (req, res) => {
  const state = getTenantState(getTenantId(req));
  const { name, healthScore, renewalMonth, expansionPotential } = req.body as Partial<Customer>;

  if (!name || !renewalMonth || !expansionPotential) {
    res.status(400).json({ message: "Customer name, renewal month, and expansion potential are required." });
    return;
  }

  const numericHealthScore = Number(healthScore ?? 80);
  if (!Number.isFinite(numericHealthScore)) {
    res.status(400).json({ message: "Health score must be a valid number." });
    return;
  }

  const customer: Customer = {
    id: `cus-${randomUUID()}`,
    name,
    healthScore: Math.max(0, Math.min(100, Math.round(numericHealthScore))),
    renewalMonth,
    expansionPotential
  };

  state.customers.unshift(customer);
  await persistStore();
  res.status(201).json(customer);
});

app.get("/api/sales/orders", (req, res) => {
  const state = getTenantState(getTenantId(req));
  res.json([...state.orders].sort((left, right) => left.month.localeCompare(right.month)));
});

app.post("/api/sales/orders", async (req, res) => {
  const state = getTenantState(getTenantId(req));
  const { month, booked, won } = req.body as Partial<Order>;

  if (!month) {
    res.status(400).json({ message: "Month is required." });
    return;
  }

  const numericBooked = Number(booked ?? 0);
  const numericWon = Number(won ?? 0);
  if (!Number.isFinite(numericBooked) || !Number.isFinite(numericWon)) {
    res.status(400).json({ message: "Booked and won values must be valid numbers." });
    return;
  }

  const order: Order = {
    id: `ord-${randomUUID()}`,
    month,
    booked: Number(numericBooked.toFixed(1)),
    won: Number(numericWon.toFixed(1))
  };

  state.orders.push(order);
  await persistStore();
  res.status(201).json(order);
});

void loadStore().then(() => {
  app.listen(port, () => {
    console.log(`Sales service listening on http://localhost:${port}`);
  });
});
