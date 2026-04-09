import cors from "cors";
import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type InventoryProduct = {
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

type Warehouse = {
  id: string;
  name: string;
  utilization: number;
  outboundToday: number;
  inboundToday: number;
};

type InventoryMovement = {
  id: string;
  productId: string;
  delta: number;
  note: string;
  createdAt: string;
};

type InventoryState = {
  products: InventoryProduct[];
  warehouses: Warehouse[];
  movements: InventoryMovement[];
};

type InventoryStore = Record<string, InventoryState>;

const app = express();
const port = Number(process.env.PORT ?? 4101);
const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const stateFile = path.join(dataDirectory, "inventory.json");

let store: InventoryStore = {};

app.use(cors());
app.use(express.json());

function formatTrend(stock: number, reorderPoint: number) {
  const delta = stock - reorderPoint;
  if (delta >= reorderPoint * 0.4) {
    return "+18%";
  }
  if (delta >= 0) {
    return "+6%";
  }
  if (delta <= -reorderPoint * 0.4) {
    return "-22%";
  }
  return "-9%";
}

function seedState(): InventoryState {
  const warehouses: Warehouse[] = [
    {
      id: "wh-1",
      name: "Mumbai Central",
      utilization: 82,
      outboundToday: 320,
      inboundToday: 180
    },
    {
      id: "wh-2",
      name: "Pune North",
      utilization: 74,
      outboundToday: 210,
      inboundToday: 154
    },
    {
      id: "wh-3",
      name: "Delhi Prime",
      utilization: 69,
      outboundToday: 268,
      inboundToday: 233
    },
    {
      id: "wh-4",
      name: "Chennai South",
      utilization: 88,
      outboundToday: 192,
      inboundToday: 141
    }
  ];

  const products: InventoryProduct[] = [
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
      trend: "-9%"
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
      trend: "-22%"
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
      trend: "+18%"
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
      trend: "-22%"
    }
  ];

  return {
    products,
    warehouses,
    movements: []
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
    store = JSON.parse(contents) as InventoryStore;
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

function updateWarehouseMetrics(state: InventoryState) {
  const warehouseProducts = new Map<string, InventoryProduct[]>();

  for (const product of state.products) {
    warehouseProducts.set(product.warehouse, [...(warehouseProducts.get(product.warehouse) ?? []), product]);
  }

  state.warehouses = state.warehouses.map((warehouse) => {
    const products = warehouseProducts.get(warehouse.name) ?? [];
    const totalUnits = products.reduce((sum, product) => sum + product.stock, 0);
    const lowStockCount = products.filter((product) => product.stock <= product.reorderPoint).length;

    return {
      ...warehouse,
      utilization: Math.min(96, Math.max(48, 55 + Math.round(totalUnits / 25))),
      outboundToday: Math.max(50, Math.round(totalUnits * 0.52)),
      inboundToday: Math.max(24, Math.round(totalUnits * 0.34 + lowStockCount * 8))
    };
  });
}

function buildForecast(state: InventoryState) {
  const totalStock = state.products.reduce((sum, product) => sum + product.stock, 0);
  const baseDemand = Math.max(180, Math.round(totalStock / Math.max(state.products.length, 1)));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

  return months.map((month, index) => {
    const actual = baseDemand + index * 18;
    const lowStockPenalty = state.products.filter((product) => product.stock < product.reorderPoint).length * 4;

    return {
      month,
      actual,
      predicted: actual + 10 + lowStockPenalty
    };
  });
}

function buildAlerts(state: InventoryState) {
  return state.products
    .filter((product) => product.stock <= product.reorderPoint)
    .sort((left, right) => left.stock - right.stock)
    .slice(0, 4)
    .map((product, index) => ({
      id: `alt-${index + 1}`,
      severity: product.stock <= Math.max(5, Math.round(product.reorderPoint * 0.5)) ? "high" : "medium",
      title: `${product.name} is under reorder threshold`,
      detail: `${product.stock} units remain in ${product.warehouse}. Supplier ${product.supplier} should be contacted immediately.`
    }));
}

function buildRecommendations(state: InventoryState) {
  const lowStockProducts = state.products.filter((product) => product.stock <= product.reorderPoint);
  const hottestWarehouse = [...state.warehouses].sort((left, right) => right.utilization - left.utilization)[0];

  return [
    {
      title: "Prioritize replenishment for at-risk SKUs",
      detail: lowStockProducts.length
        ? `${lowStockProducts.map((product) => product.sku).join(", ")} need restocking to maintain fulfillment.`
        : "All SKUs are above reorder thresholds. Maintain the current supplier cadence.",
      savings: `${Math.max(2.1, lowStockProducts.length * 1.3).toFixed(1)} pts service-level protection`
    },
    {
      title: "Balance workload across warehouses",
      detail: hottestWarehouse
        ? `${hottestWarehouse.name} is the busiest node today. Reassign inbound receipts if utilization exceeds 90%.`
        : "Warehouse activity is balanced across the network.",
      savings: "₹11.9 lakh handling efficiency opportunity"
    }
  ];
}

function buildSnapshot(tenantId: string) {
  const state = getTenantState(tenantId);
  updateWarehouseMetrics(state);

  const stockUnits = state.products.reduce((sum, product) => sum + product.stock, 0);
  const lowStockItems = state.products.filter((product) => product.stock <= product.reorderPoint).length;
  const fulfillmentRate = Number(Math.max(84, 99 - lowStockItems * 1.4).toFixed(1));

  return {
    tenantId,
    overview: {
      totalSkus: state.products.length,
      stockUnits,
      warehouses: state.warehouses.length,
      lowStockItems,
      fulfillmentRate
    },
    products: [...state.products].sort((left, right) => left.name.localeCompare(right.name)),
    warehouses: state.warehouses,
    alerts: buildAlerts(state),
    forecast: buildForecast(state),
    recommendations: buildRecommendations(state)
  };
}

app.get("/", (_req, res) => {
  res.json({
    name: "inventory-service",
    status: "ok",
    docs: {
      health: "/health",
      overview: "/api/inventory/overview",
      products: "/api/inventory/products"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "inventory-service" });
});

app.get("/api/inventory/overview", (req, res) => {
  res.json(buildSnapshot(getTenantId(req)));
});

app.get("/api/inventory/products", (req, res) => {
  const state = getTenantState(getTenantId(req));
  res.json([...state.products].sort((left, right) => left.name.localeCompare(right.name)));
});

app.get("/api/inventory/warehouses", (req, res) => {
  const state = getTenantState(getTenantId(req));
  updateWarehouseMetrics(state);
  res.json(state.warehouses);
});

app.post("/api/inventory/products", async (req, res) => {
  const tenantId = getTenantId(req);
  const state = getTenantState(tenantId);
  const {
    sku,
    name,
    category,
    supplier,
    warehouse,
    stock,
    reorderPoint,
    unitCost
  } = req.body as Partial<InventoryProduct>;

  if (!sku || !name || !category || !supplier || !warehouse) {
    res.status(400).json({ message: "SKU, name, category, supplier, and warehouse are required." });
    return;
  }

  const numericStock = Number(stock ?? 0);
  const numericReorderPoint = Number(reorderPoint ?? 0);
  const numericUnitCost = Number(unitCost ?? 0);

  if (!Number.isFinite(numericStock) || !Number.isFinite(numericReorderPoint) || !Number.isFinite(numericUnitCost)) {
    res.status(400).json({ message: "Stock, reorder point, and unit cost must be valid numbers." });
    return;
  }

  const existingWarehouse = state.warehouses.find((entry) => entry.name === warehouse);
  if (!existingWarehouse) {
    state.warehouses.push({
      id: `wh-${randomUUID()}`,
      name: warehouse,
      utilization: 61,
      outboundToday: 80,
      inboundToday: 40
    });
  }

  const product: InventoryProduct = {
    id: `prd-${randomUUID()}`,
    sku,
    name,
    category,
    supplier,
    warehouse,
    stock: Math.max(0, Math.round(numericStock)),
    reorderPoint: Math.max(0, Math.round(numericReorderPoint)),
    unitCost: Math.max(0, Math.round(numericUnitCost)),
    trend: formatTrend(numericStock, numericReorderPoint)
  };

  state.products.unshift(product);
  await persistStore();
  res.status(201).json(product);
});

app.patch("/api/inventory/products/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  const state = getTenantState(tenantId);
  const product = state.products.find((entry) => entry.id === req.params.id);

  if (!product) {
    res.status(404).json({ message: "Product not found." });
    return;
  }

  const nextWarehouse = typeof req.body?.warehouse === "string" && req.body.warehouse.trim() ? req.body.warehouse.trim() : product.warehouse;
  if (!state.warehouses.some((entry) => entry.name === nextWarehouse)) {
    state.warehouses.push({
      id: `wh-${randomUUID()}`,
      name: nextWarehouse,
      utilization: 58,
      outboundToday: 72,
      inboundToday: 31
    });
  }

  const nextStock = req.body?.stock === undefined ? product.stock : Number(req.body.stock);
  const nextReorderPoint = req.body?.reorderPoint === undefined ? product.reorderPoint : Number(req.body.reorderPoint);
  const nextUnitCost = req.body?.unitCost === undefined ? product.unitCost : Number(req.body.unitCost);

  if (!Number.isFinite(nextStock) || !Number.isFinite(nextReorderPoint) || !Number.isFinite(nextUnitCost)) {
    res.status(400).json({ message: "Stock, reorder point, and unit cost must be valid numbers." });
    return;
  }

  product.sku = typeof req.body?.sku === "string" ? req.body.sku : product.sku;
  product.name = typeof req.body?.name === "string" ? req.body.name : product.name;
  product.category = typeof req.body?.category === "string" ? req.body.category : product.category;
  product.supplier = typeof req.body?.supplier === "string" ? req.body.supplier : product.supplier;
  product.warehouse = nextWarehouse;
  product.stock = Math.max(0, Math.round(nextStock));
  product.reorderPoint = Math.max(0, Math.round(nextReorderPoint));
  product.unitCost = Math.max(0, Math.round(nextUnitCost));
  product.trend = formatTrend(product.stock, product.reorderPoint);

  await persistStore();
  res.json(product);
});

app.post("/api/inventory/products/:id/adjust-stock", async (req, res) => {
  const tenantId = getTenantId(req);
  const state = getTenantState(tenantId);
  const product = state.products.find((entry) => entry.id === req.params.id);

  if (!product) {
    res.status(404).json({ message: "Product not found." });
    return;
  }

  const delta = Number(req.body?.delta);
  if (!Number.isFinite(delta) || delta === 0) {
    res.status(400).json({ message: "A non-zero stock adjustment is required." });
    return;
  }

  product.stock = Math.max(0, product.stock + Math.round(delta));
  product.trend = formatTrend(product.stock, product.reorderPoint);
  state.movements.unshift({
    id: `mov-${randomUUID()}`,
    productId: product.id,
    delta: Math.round(delta),
    note: typeof req.body?.note === "string" ? req.body.note : "Manual stock adjustment",
    createdAt: new Date().toISOString()
  });

  const warehouse = state.warehouses.find((entry) => entry.name === product.warehouse);
  if (warehouse) {
    if (delta > 0) {
      warehouse.inboundToday += Math.round(delta);
    } else {
      warehouse.outboundToday += Math.abs(Math.round(delta));
    }
  }

  await persistStore();
  res.json(product);
});

void loadStore().then(() => {
  app.listen(port, () => {
    console.log(`Inventory service listening on http://localhost:${port}`);
  });
});
