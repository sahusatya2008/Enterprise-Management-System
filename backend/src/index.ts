import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSchema } from "graphql";
import { createHandler } from "graphql-http/lib/use/express";
import jwt from "jsonwebtoken";

type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";
type AccountStatus = "ACTIVE" | "SUSPENDED";
type AuditSeverity = "info" | "warning" | "critical";

type AppUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
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

type TokenPayload = {
  sub: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string;
};

type AuthedRequest = Request & {
  user?: TokenPayload;
};

type Notification = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "info";
  module: string;
  detail: string;
  createdAt: string;
};

type AuditLogEntry = {
  id: string;
  action: string;
  actor: string;
  module: string;
  detail: string;
  timestamp: string;
  severity: AuditSeverity;
  subjectId?: string;
  subjectEmail?: string;
  ipAddress?: string;
};

const app = express();
const port = Number(process.env.PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET ?? "erp-demo-secret";
const eventBus = new EventEmitter();
const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const usersFile = path.join(dataDirectory, "users.json");
const auditLogsFile = path.join(dataDirectory, "audit-logs.json");
const loginRateWindowMs = 10 * 60 * 1000;
const loginRateLimit = 15;
const accountLockThreshold = 5;
const accountLockMinutes = 15;

const seedUsers = [
  {
    id: "usr-admin",
    name: "Avery Morgan",
    email: "admin@northstar.com",
    password: "password123",
    role: "ADMIN" as const,
    title: "Chief Operating Officer",
    tenantId: "northstar-holdings",
    department: "Executive"
  },
  {
    id: "usr-manager",
    name: "Jordan Lee",
    email: "manager@northstar.com",
    password: "password123",
    role: "MANAGER" as const,
    title: "Operations Manager",
    tenantId: "northstar-holdings",
    department: "Operations"
  },
  {
    id: "usr-employee",
    name: "Riya Shah",
    email: "employee@northstar.com",
    password: "password123",
    role: "EMPLOYEE" as const,
    title: "Business Analyst",
    tenantId: "northstar-holdings",
    department: "Business Operations"
  }
];

let users: AppUser[] = [];
let auditLogs: AuditLogEntry[] = [];
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const liveNotifications: Notification[] = [];
const notificationStreams = new Set<Response>();

const serviceUrls = {
  inventory: process.env.INVENTORY_SERVICE_URL ?? "http://localhost:4101",
  hr: process.env.HR_SERVICE_URL ?? "http://localhost:4102",
  finance: process.env.FINANCE_SERVICE_URL ?? "http://localhost:4103",
  sales: process.env.SALES_SERVICE_URL ?? "http://localhost:4104",
  analytics: process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:5001"
};

app.disable("x-powered-by");
app.use(cors());
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "Northstar ERP Gateway",
    status: "ok",
    auth: {
      login: "POST /api/auth/login",
      register: "POST /api/auth/register"
    },
    docs: {
      health: "/health",
      graphql: "GET /graphql",
      dashboard: "GET /api/dashboard/overview"
    }
  });
});

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hashedPassword = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hashedPassword}`;
}

function nowIso() {
  return new Date().toISOString();
}

function validatePasswordPolicy(password: string) {
  if (password.length < 12) {
    return "Password must be at least 12 characters long.";
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Password must include upper, lower, number, and special characters.";
  }

  return null;
}

function generateTemporaryPassword(length = 18) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function isUserLocked(user: AppUser) {
  return Boolean(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());
}

function extractIpAddress(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function registerLoginAttempt(key: string) {
  const current = loginAttempts.get(key);
  const now = Date.now();

  if (!current || current.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + loginRateWindowMs });
    return 1;
  }

  current.count += 1;
  return current.count;
}

function clearLoginAttempts(key: string) {
  loginAttempts.delete(key);
}

function isRateLimited(key: string) {
  const current = loginAttempts.get(key);
  return Boolean(current && current.resetAt >= Date.now() && current.count >= loginRateLimit);
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, storedDigest] = storedHash.split(":");
  if (!salt || !storedDigest) {
    return false;
  }

  const incomingDigest = scryptSync(password, salt, 64);
  const expectedDigest = Buffer.from(storedDigest, "hex");

  return expectedDigest.length === incomingDigest.length && timingSafeEqual(expectedDigest, incomingDigest);
}

function sanitizeUser(user: AppUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    tenantId: user.tenantId,
    department: user.department,
    status: user.status,
    mustRotatePassword: user.mustRotatePassword,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
    lastLoginAt: user.lastLoginAt,
    lastPasswordChangeAt: user.lastPasswordChangeAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function normalizeUser(user: Omit<AppUser, "status" | "mustRotatePassword" | "failedLoginAttempts" | "lockedUntil" | "lastLoginAt" | "lastPasswordChangeAt" | "createdAt" | "updatedAt"> & Partial<AppUser>): AppUser {
  const baselineTimestamp = user.createdAt ?? nowIso();

  return {
    ...user,
    status: user.status ?? "ACTIVE",
    mustRotatePassword: user.mustRotatePassword ?? false,
    failedLoginAttempts: user.failedLoginAttempts ?? 0,
    lockedUntil: user.lockedUntil ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    lastPasswordChangeAt: user.lastPasswordChangeAt ?? baselineTimestamp,
    createdAt: baselineTimestamp,
    updatedAt: user.updatedAt ?? baselineTimestamp
  };
}

function buildSeedUsers(): AppUser[] {
  return seedUsers.map(({ password, ...user }) =>
    normalizeUser({
      ...user,
      passwordHash: hashPassword(password),
      mustRotatePassword: false
    })
  );
}

async function persistUsers() {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
}

async function persistAuditLogs() {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(auditLogsFile, JSON.stringify(auditLogs, null, 2), "utf8");
}

async function loadUsers() {
  await mkdir(dataDirectory, { recursive: true });

  try {
    const fileContents = await readFile(usersFile, "utf8");
    const parsedUsers = JSON.parse(fileContents) as AppUser[];
    users = parsedUsers.length > 0 ? parsedUsers.map((user) => normalizeUser(user)) : buildSeedUsers();
  } catch {
    users = buildSeedUsers();
    await persistUsers();
  }
}

async function loadAuditLogs() {
  await mkdir(dataDirectory, { recursive: true });

  try {
    const fileContents = await readFile(auditLogsFile, "utf8");
    const parsedLogs = JSON.parse(fileContents) as AuditLogEntry[];
    auditLogs = parsedLogs;
  } catch {
    auditLogs = [
      {
        id: "audit-100",
        action: "SYSTEM_BOOT",
        actor: "platform",
        module: "core",
        detail: "ERP control plane initialized with live module adapters.",
        timestamp: nowIso(),
        severity: "info"
      }
    ];
    await persistAuditLogs();
  }
}

function resolveUserFromToken(authorization?: string | string[]) {
  const tokenPayload = decodeToken(authorization);
  if (!tokenPayload) {
    return null;
  }

  const currentUser = users.find((user) => user.id === tokenPayload.sub);
  if (!currentUser) {
    return null;
  }

  return {
    sub: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    role: currentUser.role,
    tenantId: currentUser.tenantId
  } satisfies TokenPayload;
}

function issueToken(user: AppUser) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId
    },
    jwtSecret,
    { expiresIn: "8h" }
  );
}

function extractHeaderValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function decodeToken(authorization?: string | string[]): TokenPayload | null {
  const rawAuthorization = extractHeaderValue(authorization);

  if (!rawAuthorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = rawAuthorization.replace("Bearer ", "");

  try {
    return jwt.verify(token, jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}

function getCurrentUserFromRequest(req: AuthedRequest) {
  if (!req.user) {
    return null;
  }

  return users.find((user) => user.id === req.user?.sub) ?? null;
}

function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const decoded = decodeToken(req.headers.authorization);
  if (!decoded) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  const currentUser = users.find((user) => user.id === decoded.sub);
  if (!currentUser) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  if (currentUser.status !== "ACTIVE") {
    res.status(403).json({ message: "This account is suspended." });
    return;
  }

  if (isUserLocked(currentUser)) {
    res.status(423).json({ message: `Account locked until ${currentUser.lockedUntil}.` });
    return;
  }

  req.user = {
    sub: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    role: currentUser.role,
    tenantId: currentUser.tenantId
  };
  next();
}

function authorize(roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "You do not have access to this resource." });
      return;
    }

    next();
  };
}

function recordAudit(
  actor: string,
  action: string,
  module: string,
  detail: string,
  options?: { severity?: AuditSeverity; subjectId?: string; subjectEmail?: string; ipAddress?: string }
) {
  auditLogs.unshift({
    id: `audit-${auditLogs.length + 101}`,
    action,
    actor,
    module,
    detail,
    timestamp: nowIso(),
    severity: options?.severity ?? "info",
    subjectId: options?.subjectId,
    subjectEmail: options?.subjectEmail,
    ipAddress: options?.ipAddress
  });

  auditLogs = auditLogs.slice(0, 500);
  void persistAuditLogs();
}

function pushNotification(title: string, module: string, severity: Notification["severity"], detail: string) {
  const notification: Notification = {
    id: `notification-${Date.now()}`,
    title,
    severity,
    module,
    detail,
    createdAt: new Date().toISOString()
  };

  liveNotifications.unshift(notification);
  eventBus.emit("notification", notification);
}

eventBus.on("notification", (notification: Notification) => {
  const payload = `data: ${JSON.stringify(notification)}\n\n`;
  for (const stream of notificationStreams) {
    stream.write(payload);
  }
});

async function requestService<T>(url: string, options?: { body?: unknown; method?: string; tenantId?: string }): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.tenantId) {
    headers["x-tenant-id"] = options.tenantId;
  }

  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed ${options?.method ?? "GET"} ${url}: ${response.status}${detail ? ` ${detail}` : ""}`);
  }

  return (await response.json()) as T;
}

async function getJson<T>(url: string, tenantId: string): Promise<T> {
  return requestService<T>(url, { tenantId });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  return requestService<T>(url, { method: "POST", body });
}

async function patchJson<T>(url: string, body: unknown, tenantId: string): Promise<T> {
  return requestService<T>(url, { method: "PATCH", body, tenantId });
}

async function postTenantJson<T>(url: string, tenantId: string, body: unknown): Promise<T> {
  return requestService<T>(url, { method: "POST", body, tenantId });
}

async function getDomainModules(tenantId: string) {
  const [inventory, hr, finance, sales] = await Promise.all([
    getJson<Record<string, unknown>>(`${serviceUrls.inventory}/api/inventory/overview`, tenantId),
    getJson<Record<string, unknown>>(`${serviceUrls.hr}/api/hr/overview`, tenantId),
    getJson<Record<string, unknown>>(`${serviceUrls.finance}/api/finance/overview`, tenantId),
    getJson<Record<string, unknown>>(`${serviceUrls.sales}/api/sales/overview`, tenantId)
  ]);

  return { inventory, hr, finance, sales };
}

function buildNotifications(modules: {
  inventory: Record<string, unknown>;
  hr: Record<string, unknown>;
  finance: Record<string, unknown>;
  sales: Record<string, unknown>;
}) {
  const inventoryOverview = modules.inventory.overview as Record<string, number>;
  const hrOverview = modules.hr.overview as Record<string, number>;
  const financeOverview = modules.finance.overview as Record<string, number>;

  return [
    ...liveNotifications.slice(0, 3),
    {
      id: "notif-low-stock",
      title: "Low stock cluster detected",
      severity: "high",
      module: "inventory",
      detail: `${inventoryOverview.lowStockItems} SKUs are under their reorder point across active warehouses.`,
      createdAt: new Date().toISOString()
    },
    {
      id: "notif-attrition",
      title: "Attrition pulse trending upward",
      severity: "medium",
      module: "hr",
      detail: `Attrition exposure is ${hrOverview.attritionRisk}% and needs retention action in Sales Ops.`,
      createdAt: new Date().toISOString()
    },
    {
      id: "notif-margin",
      title: "Margin compression watch",
      severity: "medium",
      module: "finance",
      detail: `Net margin is ${financeOverview.margin}% while discretionary spend remains elevated.`,
      createdAt: new Date().toISOString()
    }
  ];
}

async function buildDashboard(tenantId: string) {
  const modules = await getDomainModules(tenantId);
  const intelligence = await postJson<Record<string, unknown>>(
    `${serviceUrls.analytics}/decision-intelligence`,
    { tenantId, ...modules }
  );

  const financeOverview = modules.finance.overview as Record<string, number>;
  const salesOverview = modules.sales.overview as Record<string, number>;
  const inventoryOverview = modules.inventory.overview as Record<string, number>;
  const hrOverview = modules.hr.overview as Record<string, number>;

  return {
    tenant: tenantId,
    generatedAt: new Date().toISOString(),
    scorecard: {
      growth: Number((salesOverview.conversionRate * 1.35).toFixed(1)),
      operations: Number((inventoryOverview.fulfillmentRate * 0.92).toFixed(1)),
      financeHealth: Number((financeOverview.cashReserve / 10000).toFixed(1)),
      workforceHealth: Number((100 - hrOverview.attritionRisk + hrOverview.attendanceRate / 2).toFixed(1))
    },
    ...modules,
    intelligence,
    notifications: buildNotifications(modules),
    auditLogs: auditLogs.slice(0, 8)
  };
}

function sendUpstreamError(res: Response, message: string, error: unknown) {
  res.status(502).json({
    message,
    detail: error instanceof Error ? error.message : "Unknown error."
  });
}

async function findHrProfileForUser(user: AppUser) {
  try {
    const employees = await getJson<Array<Record<string, unknown>>>(`${serviceUrls.hr}/api/hr/employees`, user.tenantId);
    return (
      employees.find((employee) => {
        const employeeName = typeof employee.name === "string" ? employee.name : "";
        const employeeDepartment = typeof employee.department === "string" ? employee.department : "";
        return employeeName.toLowerCase() === user.name.toLowerCase() || employeeDepartment.toLowerCase() === user.department.toLowerCase();
      }) ?? null
    );
  } catch {
    return null;
  }
}

function getUserActivityLogs(user: AppUser) {
  return auditLogs
    .filter(
      (entry) =>
        entry.actor.toLowerCase() === user.email.toLowerCase() ||
        entry.subjectId === user.id ||
        entry.subjectEmail?.toLowerCase() === user.email.toLowerCase()
    )
    .slice(0, 40);
}

async function buildEmployeeActivityProfile(user: AppUser) {
  const hrProfile = await findHrProfileForUser(user);
  const activity = getUserActivityLogs(user);

  try {
    const analysis = await postJson<Record<string, unknown>>(`${serviceUrls.analytics}/employee-activity-analysis`, {
      user: sanitizeUser(user),
      activity,
      hrProfile
    });

    return {
      user: sanitizeUser(user),
      hrProfile,
      activity,
      analysis
    };
  } catch {
    return {
      user: sanitizeUser(user),
      hrProfile,
      activity,
      analysis: {
        riskLevel: user.status === "SUSPENDED" || isUserLocked(user) ? "high" : user.mustRotatePassword ? "medium" : "low",
        executiveSummary: `${user.name} has ${activity.length} recent tracked actions and ${user.failedLoginAttempts} failed login attempts.`,
        activitySignal: activity.length >= 6 ? "high-engagement" : "steady",
        securitySignal: isUserLocked(user) ? "locked" : user.mustRotatePassword ? "rotation-required" : "healthy",
        recommendedActions: [
          user.mustRotatePassword ? "Force a password change at the next sign-in." : "Keep the current credential posture under observation.",
          user.status === "SUSPENDED" ? "Review access before reactivation." : "Maintain periodic access reviews."
        ]
      }
    };
  }
}

async function buildSecurityOverview() {
  const userSummaries = users.map(sanitizeUser);
  const lockedAccounts = users.filter((user) => isUserLocked(user)).length;
  const suspendedAccounts = users.filter((user) => user.status === "SUSPENDED").length;
  const rotationRequired = users.filter((user) => user.mustRotatePassword).length;
  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const recentWarnings = auditLogs.filter((entry) => entry.severity !== "info").slice(0, 10);

  try {
    const analysis = await postJson<Record<string, unknown>>(`${serviceUrls.analytics}/security-review`, {
      users: userSummaries,
      auditLogs: auditLogs.slice(0, 120),
      metrics: {
        lockedAccounts,
        suspendedAccounts,
        rotationRequired,
        adminCount
      }
    });

    return {
      lockedAccounts,
      suspendedAccounts,
      rotationRequired,
      adminCount,
      recentWarnings,
      analysis
    };
  } catch {
    return {
      lockedAccounts,
      suspendedAccounts,
      rotationRequired,
      adminCount,
      recentWarnings,
      analysis: {
        overallRisk: lockedAccounts > 0 || suspendedAccounts > 0 ? "elevated" : "controlled",
        summary: "Credential controls, audit telemetry, and access posture are being monitored.",
        findings: [
          `${rotationRequired} account(s) require a forced password change.`,
          `${adminCount} admin account(s) currently hold elevated access.`
        ],
        recommendations: [
          "Rotate privileged credentials regularly.",
          "Keep inactive or suspended accounts out of the daily access path."
        ]
      }
    };
  }
}

async function buildAiWorkbench(tenantId: string) {
  const dashboard = await buildDashboard(tenantId);

  try {
    const workbench = await postJson<Record<string, unknown>>(`${serviceUrls.analytics}/ai-workbench`, {
      dashboard,
      users: users.map(sanitizeUser),
      auditLogs: auditLogs.slice(0, 100)
    });

    return workbench;
  } catch {
    return {
      tools: [
        { id: "executive-brief", title: "Executive Brief", summary: "Cross-functional summary for the leadership team.", priority: "high" },
        { id: "supply-chain", title: "Supply Chain Advisor", summary: "Demand, inventory, and fulfillment guidance.", priority: "high" },
        { id: "working-capital", title: "Working Capital Monitor", summary: "Cash reserve, invoices, and spend pressure.", priority: "medium" },
        { id: "workforce", title: "Workforce Coach", summary: "Attrition, productivity, and hiring focus.", priority: "medium" },
        { id: "revenue", title: "Revenue Lens", summary: "Pipeline quality and forecast focus.", priority: "high" },
        { id: "security", title: "Security Review", summary: "Credential and audit posture summary.", priority: "high" },
        { id: "supplier-intelligence", title: "Supplier Intelligence", summary: "Lane-level supplier and stock priorities.", priority: "medium" },
        { id: "policy-guard", title: "Policy Guard", summary: "Password rotation and privilege review.", priority: "high" },
        { id: "anomaly-radar", title: "Anomaly Radar", summary: "Cross-module warning pattern detection.", priority: "medium" }
      ],
      executiveBrief: {
        summary: "Growth is healthy, but people capacity and stock buffers need active management.",
        recommendation: "Prioritize fulfillment coverage, collections, and controlled hiring."
      },
      supplyChain: {
        summary: "Inventory pressure is concentrated in replenishment-sensitive lanes.",
        recommendation: "Advance critical supplier approvals before service levels dip."
      },
      workingCapital: {
        summary: "Cash preservation still matters even with healthy top-line movement.",
        recommendation: "Accelerate collections before approving new discretionary spend."
      },
      workforce: {
        summary: "People capacity should expand only in operational bottlenecks.",
        recommendation: "Retain high-impact operators before adding broad headcount."
      },
      revenue: {
        summary: "Revenue momentum is positive but execution discipline remains the constraint.",
        recommendation: "Protect late-stage deals and proposal turnaround."
      },
      security: {
        summary: "Credential controls and privileged access need active governance.",
        recommendation: "Review admin access and password rotation actions every week."
      },
      supplierIntelligence: {
        summary: "Supplier lanes should be prioritized by low-stock exposure and warehouse pressure.",
        recommendation: "Escalate only the suppliers attached to critical SKUs first."
      },
      policyGuard: {
        summary: "Identity policy should remain strict as the ERP surface expands.",
        recommendation: "Keep forced rotation and access reviews in the default workflow."
      },
      anomalyRadar: {
        summary: "Cross-module anomalies should be triaged by business impact, not alert count.",
        recommendation: "Focus on revenue, fulfillment, and privileged-access warnings first."
      }
    };
  }
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "erp-gateway",
    services: serviceUrls
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const user = users.find((entry) => entry.email.toLowerCase() === email?.toLowerCase());
  const ipAddress = extractIpAddress(req);
  const emailKey = `email:${email?.toLowerCase() ?? "unknown"}`;
  const ipKey = `ip:${ipAddress}`;

  if (isRateLimited(emailKey) || isRateLimited(ipKey)) {
    res.status(429).json({ message: "Too many login attempts. Please wait before trying again." });
    return;
  }

  if (!user || !password || !verifyPassword(password, user.passwordHash)) {
    registerLoginAttempt(emailKey);
    registerLoginAttempt(ipKey);

    if (user) {
      user.failedLoginAttempts += 1;
      user.updatedAt = nowIso();
      if (user.failedLoginAttempts >= accountLockThreshold) {
        user.lockedUntil = new Date(Date.now() + accountLockMinutes * 60_000).toISOString();
      }
      await persistUsers();
      recordAudit(user.email, "LOGIN_FAILED", "auth", "A login attempt failed.", {
        severity: "warning",
        subjectId: user.id,
        subjectEmail: user.email,
        ipAddress
      });
    }

    res.status(401).json({ message: "Invalid email or password." });
    return;
  }

  if (user.status !== "ACTIVE") {
    res.status(403).json({ message: "This account is suspended." });
    return;
  }

  if (isUserLocked(user)) {
    res.status(423).json({ message: `Account locked until ${user.lockedUntil}.` });
    return;
  }

  clearLoginAttempts(emailKey);
  clearLoginAttempts(ipKey);
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = nowIso();
  user.updatedAt = nowIso();
  await persistUsers();

  recordAudit(user.email, "LOGIN", "auth", "User authenticated successfully.", {
    subjectId: user.id,
    subjectEmail: user.email,
    ipAddress
  });
  pushNotification("User session started", "auth", "info", `${user.name} signed in as ${user.role}.`);

  res.json({
    token: issueToken(user),
    user: sanitizeUser(user)
  });
});

app.get("/api/auth/me", authenticate, (req: AuthedRequest, res) => {
  const currentUser = users.find((user) => user.id === req.user?.sub);
  res.json(currentUser ? sanitizeUser(currentUser) : req.user);
});

app.post("/api/auth/change-password", authenticate, async (req: AuthedRequest, res) => {
  const currentUser = getCurrentUserFromRequest(req);
  const { currentPassword, nextPassword } = req.body as { currentPassword?: string; nextPassword?: string };

  if (!currentUser) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  if (!currentPassword || !nextPassword) {
    res.status(400).json({ message: "Current password and next password are required." });
    return;
  }

  if (!verifyPassword(currentPassword, currentUser.passwordHash)) {
    res.status(401).json({ message: "Current password is incorrect." });
    return;
  }

  const passwordIssue = validatePasswordPolicy(nextPassword);
  if (passwordIssue) {
    res.status(400).json({ message: passwordIssue });
    return;
  }

  currentUser.passwordHash = hashPassword(nextPassword);
  currentUser.mustRotatePassword = false;
  currentUser.lastPasswordChangeAt = nowIso();
  currentUser.updatedAt = nowIso();
  await persistUsers();

  recordAudit(currentUser.email, "CHANGE_PASSWORD", "auth", "User rotated their password.", {
    subjectId: currentUser.id,
    subjectEmail: currentUser.email
  });

  res.json({
    message: "Password updated successfully.",
    user: sanitizeUser(currentUser)
  });
});

app.post("/api/auth/register", async (req, res) => {
  const {
    name,
    email,
    password,
    title,
    department,
    tenantId
  } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    title?: string;
    department?: string;
    tenantId?: string;
  };

  if (!name || !email || !password) {
    res.status(400).json({ message: "Name, email, and password are required." });
    return;
  }

  const passwordIssue = validatePasswordPolicy(password);
  if (passwordIssue) {
    res.status(400).json({ message: passwordIssue });
    return;
  }

  if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    res.status(409).json({ message: "An account with this email already exists." });
    return;
  }

  const baselineTimestamp = nowIso();
  const newUser: AppUser = normalizeUser({
    id: `usr-${randomUUID()}`,
    name,
    email,
    passwordHash: hashPassword(password),
    role: "EMPLOYEE",
    title: title?.trim() || "ERP User",
    tenantId: tenantId?.trim() || "northstar-holdings",
    department: department?.trim() || "General Operations",
    createdAt: baselineTimestamp,
    updatedAt: baselineTimestamp,
    lastPasswordChangeAt: baselineTimestamp
  });

  users.push(newUser);
  await persistUsers();
  recordAudit(newUser.email, "REGISTER", "auth", "New employee account registered.", {
    subjectId: newUser.id,
    subjectEmail: newUser.email
  });
  pushNotification("New user registered", "auth", "info", `${newUser.name} created an ERP account.`);

  res.status(201).json({
    token: issueToken(newUser),
    user: sanitizeUser(newUser)
  });
});

app.get("/api/admin/users", authenticate, authorize(["ADMIN"]), (_req, res) => {
  res.json(users.map(sanitizeUser));
});

app.patch("/api/admin/users/:id", authenticate, authorize(["ADMIN"]), async (req: AuthedRequest, res) => {
  const targetUser = users.find((user) => user.id === req.params.id);

  if (!targetUser) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  if (req.body?.role && ["ADMIN", "MANAGER", "EMPLOYEE"].includes(req.body.role)) {
    targetUser.role = req.body.role as Role;
  }
  if (typeof req.body?.title === "string" && req.body.title.trim()) {
    targetUser.title = req.body.title.trim();
  }
  if (typeof req.body?.department === "string" && req.body.department.trim()) {
    targetUser.department = req.body.department.trim();
  }
  if (req.body?.status === "ACTIVE" || req.body?.status === "SUSPENDED") {
    targetUser.status = req.body.status;
  }
  if (typeof req.body?.mustRotatePassword === "boolean") {
    targetUser.mustRotatePassword = req.body.mustRotatePassword;
  }

  targetUser.updatedAt = nowIso();
  await persistUsers();
  recordAudit(req.user!.email, "UPDATE_USER_CONTROL", "admin", `Updated admin controls for ${targetUser.email}.`, {
    subjectId: targetUser.id,
    subjectEmail: targetUser.email
  });
  res.json(sanitizeUser(targetUser));
});

app.patch("/api/admin/users/:id/role", authenticate, authorize(["ADMIN"]), async (req: AuthedRequest, res) => {
  const userId = extractHeaderValue(req.params.id);
  const nextRole = req.body?.role as Role | undefined;
  const nextTitle = typeof req.body?.title === "string" ? req.body.title : undefined;
  const nextDepartment = typeof req.body?.department === "string" ? req.body.department : undefined;

  if (!userId || !nextRole || !["ADMIN", "MANAGER", "EMPLOYEE"].includes(nextRole)) {
    res.status(400).json({ message: "A valid role update payload is required." });
    return;
  }

  const targetUser = users.find((user) => user.id === userId);
  if (!targetUser) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  targetUser.role = nextRole;
  if (nextTitle) {
    targetUser.title = nextTitle;
  }
  if (nextDepartment) {
    targetUser.department = nextDepartment;
  }

  targetUser.updatedAt = nowIso();
  await persistUsers();
  recordAudit(req.user!.email, "UPDATE_ROLE", "admin", `Updated ${targetUser.email} to ${nextRole}.`, {
    subjectId: targetUser.id,
    subjectEmail: targetUser.email
  });
  res.json(sanitizeUser(targetUser));
});

app.post("/api/admin/users/:id/reset-password", authenticate, authorize(["ADMIN"]), async (req: AuthedRequest, res) => {
  const targetUser = users.find((user) => user.id === req.params.id);
  if (!targetUser) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  const requestedPassword = typeof req.body?.password === "string" ? req.body.password : generateTemporaryPassword();
  const passwordIssue = validatePasswordPolicy(requestedPassword);
  if (passwordIssue) {
    res.status(400).json({ message: passwordIssue });
    return;
  }

  targetUser.passwordHash = hashPassword(requestedPassword);
  targetUser.mustRotatePassword = true;
  targetUser.failedLoginAttempts = 0;
  targetUser.lockedUntil = null;
  targetUser.lastPasswordChangeAt = nowIso();
  targetUser.updatedAt = nowIso();
  await persistUsers();

  recordAudit(req.user!.email, "RESET_PASSWORD", "admin", `Reset password for ${targetUser.email}.`, {
    severity: "warning",
    subjectId: targetUser.id,
    subjectEmail: targetUser.email
  });

  res.json({
    user: sanitizeUser(targetUser),
    temporaryPassword: requestedPassword,
    message: "Password reset successfully."
  });
});

app.post("/api/admin/users/:id/unlock", authenticate, authorize(["ADMIN"]), async (req: AuthedRequest, res) => {
  const targetUser = users.find((user) => user.id === req.params.id);
  if (!targetUser) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  targetUser.failedLoginAttempts = 0;
  targetUser.lockedUntil = null;
  targetUser.status = "ACTIVE";
  targetUser.updatedAt = nowIso();
  await persistUsers();

  recordAudit(req.user!.email, "UNLOCK_ACCOUNT", "admin", `Unlocked account for ${targetUser.email}.`, {
    severity: "warning",
    subjectId: targetUser.id,
    subjectEmail: targetUser.email
  });

  res.json(sanitizeUser(targetUser));
});

app.get("/api/admin/users/:id/activity", authenticate, authorize(["ADMIN"]), async (req: AuthedRequest, res) => {
  const targetUser = users.find((user) => user.id === req.params.id);
  if (!targetUser) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  res.json(await buildEmployeeActivityProfile(targetUser));
});

app.get("/api/admin/security/overview", authenticate, authorize(["ADMIN"]), async (_req, res) => {
  res.json(await buildSecurityOverview());
});

app.get("/api/dashboard/overview", authenticate, async (req: AuthedRequest, res) => {
  try {
    const dashboard = await buildDashboard(req.user!.tenantId);
    recordAudit(req.user!.email, "VIEW_DASHBOARD", "executive", "Executive cockpit snapshot loaded.");
    res.json(dashboard);
  } catch (error) {
    res.status(502).json({
      message: "Unable to assemble dashboard overview.",
      detail: error instanceof Error ? error.message : "Unknown error."
    });
  }
});

app.get("/api/modules/:module", authenticate, async (req: AuthedRequest, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const moduleName = extractHeaderValue(req.params.module);
    const moduleUrlMap: Record<string, string> = {
      inventory: `${serviceUrls.inventory}/api/inventory/overview`,
      hr: `${serviceUrls.hr}/api/hr/overview`,
      finance: `${serviceUrls.finance}/api/finance/overview`,
      sales: `${serviceUrls.sales}/api/sales/overview`
    };

    if (!moduleName || !moduleUrlMap[moduleName]) {
      res.status(404).json({ message: `Unknown module ${moduleName}.` });
      return;
    }

    const payload = await getJson<Record<string, unknown>>(moduleUrlMap[moduleName], tenantId);
    recordAudit(req.user!.email, "VIEW_MODULE", moduleName, `${moduleName} module opened through REST.`);
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      message: "Unable to load module snapshot.",
      detail: error instanceof Error ? error.message : "Unknown error."
    });
  }
});

app.get("/api/inventory/products", authenticate, async (req: AuthedRequest, res) => {
  try {
    const products = await getJson<Record<string, unknown>[]>(
      `${serviceUrls.inventory}/api/inventory/products`,
      req.user!.tenantId
    );
    res.json(products);
  } catch (error) {
    sendUpstreamError(res, "Unable to load inventory products.", error);
  }
});

app.get("/api/inventory/warehouses", authenticate, async (req: AuthedRequest, res) => {
  try {
    const warehouses = await getJson<Record<string, unknown>[]>(
      `${serviceUrls.inventory}/api/inventory/warehouses`,
      req.user!.tenantId
    );
    res.json(warehouses);
  } catch (error) {
    sendUpstreamError(res, "Unable to load warehouses.", error);
  }
});

app.post("/api/inventory/products", authenticate, authorize(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  try {
    const product = await postTenantJson<Record<string, unknown>>(
      `${serviceUrls.inventory}/api/inventory/products`,
      req.user!.tenantId,
      req.body
    );

    const productName = typeof product.name === "string" ? product.name : "inventory product";
    recordAudit(req.user!.email, "CREATE_PRODUCT", "inventory", `Created ${productName}.`);
    pushNotification("Inventory product created", "inventory", "info", `${req.user!.name} added ${productName}.`);
    res.status(201).json(product);
  } catch (error) {
    sendUpstreamError(res, "Unable to create inventory product.", error);
  }
});

app.patch("/api/inventory/products/:id", authenticate, authorize(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  try {
    const product = await patchJson<Record<string, unknown>>(
      `${serviceUrls.inventory}/api/inventory/products/${req.params.id}`,
      req.body,
      req.user!.tenantId
    );

    const productName = typeof product.name === "string" ? product.name : "inventory product";
    recordAudit(req.user!.email, "UPDATE_PRODUCT", "inventory", `Updated ${productName}.`);
    res.json(product);
  } catch (error) {
    sendUpstreamError(res, "Unable to update inventory product.", error);
  }
});

app.post(
  "/api/inventory/products/:id/adjust-stock",
  authenticate,
  authorize(["ADMIN", "MANAGER", "EMPLOYEE"]),
  async (req: AuthedRequest, res) => {
    try {
      const product = await postTenantJson<Record<string, unknown>>(
        `${serviceUrls.inventory}/api/inventory/products/${req.params.id}/adjust-stock`,
        req.user!.tenantId,
        req.body
      );

      const productName = typeof product.name === "string" ? product.name : "inventory product";
      recordAudit(req.user!.email, "ADJUST_STOCK", "inventory", `Adjusted stock for ${productName}.`);
      pushNotification("Stock updated", "inventory", "info", `${req.user!.name} adjusted stock for ${productName}.`);
      res.json(product);
    } catch (error) {
      sendUpstreamError(res, "Unable to adjust stock.", error);
    }
  }
);

app.get("/api/hr/employees", authenticate, async (req: AuthedRequest, res) => {
  try {
    const employees = await getJson<Record<string, unknown>[]>(
      `${serviceUrls.hr}/api/hr/employees`,
      req.user!.tenantId
    );
    res.json(employees);
  } catch (error) {
    sendUpstreamError(res, "Unable to load employees.", error);
  }
});

app.post("/api/hr/employees", authenticate, authorize(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  try {
    const employee = await postTenantJson<Record<string, unknown>>(
      `${serviceUrls.hr}/api/hr/employees`,
      req.user!.tenantId,
      req.body
    );

    const employeeName = typeof employee.name === "string" ? employee.name : "employee";
    recordAudit(req.user!.email, "CREATE_EMPLOYEE", "hr", `Created employee record for ${employeeName}.`);
    pushNotification("Employee added", "hr", "info", `${employeeName} joined the ERP directory.`);
    res.status(201).json(employee);
  } catch (error) {
    sendUpstreamError(res, "Unable to create employee record.", error);
  }
});

app.patch("/api/hr/employees/:id", authenticate, authorize(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  try {
    const employee = await patchJson<Record<string, unknown>>(
      `${serviceUrls.hr}/api/hr/employees/${req.params.id}`,
      req.body,
      req.user!.tenantId
    );

    const employeeName = typeof employee.name === "string" ? employee.name : "employee";
    recordAudit(req.user!.email, "UPDATE_EMPLOYEE", "hr", `Updated employee record for ${employeeName}.`);
    res.json(employee);
  } catch (error) {
    sendUpstreamError(res, "Unable to update employee record.", error);
  }
});

app.get("/api/hr/leave-requests", authenticate, async (req: AuthedRequest, res) => {
  try {
    const leaveRequests = await getJson<Record<string, unknown>[]>(
      `${serviceUrls.hr}/api/hr/leave-requests`,
      req.user!.tenantId
    );
    res.json(leaveRequests);
  } catch (error) {
    sendUpstreamError(res, "Unable to load leave requests.", error);
  }
});

app.post("/api/hr/leave-requests", authenticate, async (req: AuthedRequest, res) => {
  try {
    const leaveRequest = await postTenantJson<Record<string, unknown>>(
      `${serviceUrls.hr}/api/hr/leave-requests`,
      req.user!.tenantId,
      req.body
    );

    const employeeName = typeof leaveRequest.employeeName === "string" ? leaveRequest.employeeName : req.user!.name;
    recordAudit(req.user!.email, "CREATE_LEAVE_REQUEST", "hr", `Submitted leave request for ${employeeName}.`);
    pushNotification("Leave request submitted", "hr", "info", `${employeeName} submitted a leave request.`);
    res.status(201).json(leaveRequest);
  } catch (error) {
    sendUpstreamError(res, "Unable to submit leave request.", error);
  }
});

app.patch(
  "/api/hr/leave-requests/:id",
  authenticate,
  authorize(["ADMIN", "MANAGER"]),
  async (req: AuthedRequest, res) => {
    try {
      const leaveRequest = await patchJson<Record<string, unknown>>(
        `${serviceUrls.hr}/api/hr/leave-requests/${req.params.id}`,
        req.body,
        req.user!.tenantId
      );

      const employeeName = typeof leaveRequest.employeeName === "string" ? leaveRequest.employeeName : "employee";
      const status = typeof leaveRequest.status === "string" ? leaveRequest.status : "updated";
      recordAudit(req.user!.email, "UPDATE_LEAVE_REQUEST", "hr", `${status} leave request for ${employeeName}.`);
      res.json(leaveRequest);
    } catch (error) {
      sendUpstreamError(res, "Unable to update leave request.", error);
    }
  }
);

app.get("/api/finance/invoices", authenticate, authorize(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  try {
    const invoices = await getJson<Record<string, unknown>[]>(
      `${serviceUrls.finance}/api/finance/invoices`,
      req.user!.tenantId
    );
    res.json(invoices);
  } catch (error) {
    sendUpstreamError(res, "Unable to load invoices.", error);
  }
});

app.post("/api/finance/invoices", authenticate, authorize(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  try {
    const invoice = await postTenantJson<Record<string, unknown>>(
      `${serviceUrls.finance}/api/finance/invoices`,
      req.user!.tenantId,
      req.body
    );

    const customerName = typeof invoice.customer === "string" ? invoice.customer : "customer";
    recordAudit(req.user!.email, "CREATE_INVOICE", "finance", `Created invoice for ${customerName}.`);
    pushNotification("Invoice created", "finance", "info", `${req.user!.name} created an invoice for ${customerName}.`);
    res.status(201).json(invoice);
  } catch (error) {
    sendUpstreamError(res, "Unable to create invoice.", error);
  }
});

app.patch("/api/finance/invoices/:id", authenticate, authorize(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  try {
    const invoice = await patchJson<Record<string, unknown>>(
      `${serviceUrls.finance}/api/finance/invoices/${req.params.id}`,
      req.body,
      req.user!.tenantId
    );

    const customerName = typeof invoice.customer === "string" ? invoice.customer : "customer";
    recordAudit(req.user!.email, "UPDATE_INVOICE", "finance", `Updated invoice for ${customerName}.`);
    res.json(invoice);
  } catch (error) {
    sendUpstreamError(res, "Unable to update invoice.", error);
  }
});

app.get("/api/finance/ledger", authenticate, authorize(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  try {
    const ledger = await getJson<Record<string, unknown>[]>(
      `${serviceUrls.finance}/api/finance/ledger`,
      req.user!.tenantId
    );
    res.json(ledger);
  } catch (error) {
    sendUpstreamError(res, "Unable to load ledger entries.", error);
  }
});

app.post("/api/finance/ledger", authenticate, authorize(["ADMIN", "MANAGER"]), async (req: AuthedRequest, res) => {
  try {
    const entry = await postTenantJson<Record<string, unknown>>(
      `${serviceUrls.finance}/api/finance/ledger`,
      req.user!.tenantId,
      req.body
    );

    const accountName = typeof entry.account === "string" ? entry.account : "ledger account";
    recordAudit(req.user!.email, "POST_LEDGER_ENTRY", "finance", `Posted ledger entry to ${accountName}.`);
    pushNotification("Ledger posted", "finance", "info", `${req.user!.name} posted a ledger entry to ${accountName}.`);
    res.status(201).json(entry);
  } catch (error) {
    sendUpstreamError(res, "Unable to create ledger entry.", error);
  }
});

app.get("/api/sales/leads", authenticate, async (req: AuthedRequest, res) => {
  try {
    const leads = await getJson<Record<string, unknown>[]>(
      `${serviceUrls.sales}/api/sales/leads`,
      req.user!.tenantId
    );
    res.json(leads);
  } catch (error) {
    sendUpstreamError(res, "Unable to load sales leads.", error);
  }
});

app.post("/api/sales/leads", authenticate, async (req: AuthedRequest, res) => {
  try {
    const lead = await postTenantJson<Record<string, unknown>>(
      `${serviceUrls.sales}/api/sales/leads`,
      req.user!.tenantId,
      req.body
    );

    const companyName = typeof lead.company === "string" ? lead.company : "lead";
    recordAudit(req.user!.email, "CREATE_LEAD", "sales", `Created lead for ${companyName}.`);
    pushNotification("Lead created", "sales", "info", `${req.user!.name} created a new lead for ${companyName}.`);
    res.status(201).json(lead);
  } catch (error) {
    sendUpstreamError(res, "Unable to create lead.", error);
  }
});

app.patch("/api/sales/leads/:id", authenticate, async (req: AuthedRequest, res) => {
  try {
    const lead = await patchJson<Record<string, unknown>>(
      `${serviceUrls.sales}/api/sales/leads/${req.params.id}`,
      req.body,
      req.user!.tenantId
    );

    const companyName = typeof lead.company === "string" ? lead.company : "lead";
    recordAudit(req.user!.email, "UPDATE_LEAD", "sales", `Updated sales lead for ${companyName}.`);
    res.json(lead);
  } catch (error) {
    sendUpstreamError(res, "Unable to update lead.", error);
  }
});

app.get("/api/sales/customers", authenticate, async (req: AuthedRequest, res) => {
  try {
    const customers = await getJson<Record<string, unknown>[]>(
      `${serviceUrls.sales}/api/sales/customers`,
      req.user!.tenantId
    );
    res.json(customers);
  } catch (error) {
    sendUpstreamError(res, "Unable to load customers.", error);
  }
});

app.post("/api/sales/customers", authenticate, async (req: AuthedRequest, res) => {
  try {
    const customer = await postTenantJson<Record<string, unknown>>(
      `${serviceUrls.sales}/api/sales/customers`,
      req.user!.tenantId,
      req.body
    );

    const customerName = typeof customer.name === "string" ? customer.name : "customer";
    recordAudit(req.user!.email, "CREATE_CUSTOMER", "sales", `Created customer record for ${customerName}.`);
    res.status(201).json(customer);
  } catch (error) {
    sendUpstreamError(res, "Unable to create customer.", error);
  }
});

app.get("/api/sales/orders", authenticate, async (req: AuthedRequest, res) => {
  try {
    const orders = await getJson<Record<string, unknown>[]>(
      `${serviceUrls.sales}/api/sales/orders`,
      req.user!.tenantId
    );
    res.json(orders);
  } catch (error) {
    sendUpstreamError(res, "Unable to load sales orders.", error);
  }
});

app.post("/api/sales/orders", authenticate, async (req: AuthedRequest, res) => {
  try {
    const order = await postTenantJson<Record<string, unknown>>(
      `${serviceUrls.sales}/api/sales/orders`,
      req.user!.tenantId,
      req.body
    );

    const month = typeof order.month === "string" ? order.month : "period";
    recordAudit(req.user!.email, "CREATE_ORDER_FORECAST", "sales", `Created order record for ${month}.`);
    res.status(201).json(order);
  } catch (error) {
    sendUpstreamError(res, "Unable to create order record.", error);
  }
});

app.get("/api/notifications", authenticate, async (req: AuthedRequest, res) => {
  try {
    const modules = await getDomainModules(req.user!.tenantId);
    res.json(buildNotifications(modules));
  } catch (error) {
    res.status(502).json({
      message: "Unable to load notifications.",
      detail: error instanceof Error ? error.message : "Unknown error."
    });
  }
});

app.get("/api/notifications/stream", authenticate, (req: AuthedRequest, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  notificationStreams.add(res);
  const hello = {
    id: "notification-stream",
    title: "Notification stream connected",
    severity: "info",
    module: "core",
    detail: `Realtime channel opened for ${req.user!.name}.`,
    createdAt: new Date().toISOString()
  };

  res.write(`data: ${JSON.stringify(hello)}\n\n`);

  req.on("close", () => {
    notificationStreams.delete(res);
  });
});

app.get("/api/audit-logs", authenticate, authorize(["ADMIN", "MANAGER"]), (_req, res) => {
  res.json(auditLogs.slice(0, 25));
});

app.get("/api/account/recent-activity", authenticate, async (req: AuthedRequest, res) => {
  const currentUser = getCurrentUserFromRequest(req);
  if (!currentUser) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  res.json(getUserActivityLogs(currentUser).slice(0, 12));
});

app.post("/api/scenarios/simulate", authenticate, async (req: AuthedRequest, res) => {
  try {
    const dashboard = await buildDashboard(req.user!.tenantId);
    const simulation = await postJson<Record<string, unknown>>(
      `${serviceUrls.analytics}/scenario-simulation`,
      {
        dashboard,
        scenario: req.body
      }
    );

    recordAudit(req.user!.email, "SIMULATE_SCENARIO", "analytics", "Scenario simulation executed.");
    pushNotification("Scenario simulation complete", "analytics", "info", "An executive what-if analysis finished successfully.");
    res.json(simulation);
  } catch (error) {
    res.status(502).json({
      message: "Unable to simulate scenario.",
      detail: error instanceof Error ? error.message : "Unknown error."
    });
  }
});

app.post("/api/copilot/query", authenticate, async (req: AuthedRequest, res) => {
  try {
    const dashboard = await buildDashboard(req.user!.tenantId);
    const answer = await postJson<Record<string, unknown>>(
      `${serviceUrls.analytics}/copilot/query`,
      {
        dashboard,
        question: req.body?.question ?? ""
      }
    );

    recordAudit(req.user!.email, "ASK_COPILOT", "analytics", "Business copilot was queried.");
    res.json(answer);
  } catch (error) {
    res.status(502).json({
      message: "Unable to generate copilot answer.",
      detail: error instanceof Error ? error.message : "Unknown error."
    });
  }
});

app.get("/api/ai/workbench", authenticate, async (req: AuthedRequest, res) => {
  try {
    const workbench = await buildAiWorkbench(req.user!.tenantId);
    recordAudit(req.user!.email, "VIEW_AI_WORKBENCH", "analytics", "Opened the AI workbench.");
    res.json(workbench);
  } catch (error) {
    res.status(502).json({
      message: "Unable to load AI workbench.",
      detail: error instanceof Error ? error.message : "Unknown error."
    });
  }
});

const schema = buildSchema(`
  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
    title: String!
    tenantId: String!
    department: String!
  }

  type Notification {
    id: ID!
    title: String!
    severity: String!
    module: String!
    detail: String!
    createdAt: String!
  }

  type Insight {
    title: String!
    summary: String!
    owner: String!
    impact: String!
    confidence: Float!
  }

  type InventoryOverview {
    totalSkus: Int!
    stockUnits: Int!
    warehouses: Int!
    lowStockItems: Int!
    fulfillmentRate: Float!
  }

  type InventoryProduct {
    id: ID!
    sku: String!
    name: String!
    category: String!
    supplier: String!
    warehouse: String!
    stock: Int!
    reorderPoint: Int!
    unitCost: Float!
    trend: String!
  }

  type InventoryRecommendation {
    title: String!
    detail: String!
    savings: String!
  }

  type InventoryModule {
    tenantId: String!
    overview: InventoryOverview!
    products: [InventoryProduct!]!
    recommendations: [InventoryRecommendation!]!
  }

  type HrOverview {
    headcount: Int!
    attendanceRate: Float!
    attritionRisk: Float!
    payrollBurn: Float!
  }

  type Employee {
    id: ID!
    name: String!
    department: String!
    role: String!
    manager: String!
    performanceScore: Float!
    productivityScore: Float!
    attritionRisk: Float!
  }

  type HrRecommendation {
    title: String!
    detail: String!
    priority: String!
  }

  type HrModule {
    tenantId: String!
    overview: HrOverview!
    employees: [Employee!]!
    recommendations: [HrRecommendation!]!
  }

  type FinanceOverview {
    revenue: Float!
    expenses: Float!
    margin: Float!
    cashReserve: Float!
  }

  type LedgerEntry {
    id: ID!
    account: String!
    amount: Float!
    direction: String!
    counterparty: String!
    postedAt: String!
  }

  type FinanceRecommendation {
    title: String!
    detail: String!
    impact: String!
  }

  type FinanceModule {
    tenantId: String!
    overview: FinanceOverview!
    ledger: [LedgerEntry!]!
    recommendations: [FinanceRecommendation!]!
  }

  type SalesOverview {
    pipelineValue: Float!
    conversionRate: Float!
    wonDeals: Int!
    forecast: Float!
  }

  type Lead {
    id: ID!
    company: String!
    stage: String!
    value: Float!
    probability: Float!
    owner: String!
  }

  type SalesRecommendation {
    title: String!
    detail: String!
    confidence: Float!
  }

  type SalesModule {
    tenantId: String!
    overview: SalesOverview!
    pipeline: [Lead!]!
    recommendations: [SalesRecommendation!]!
  }

  type Scorecard {
    growth: Float!
    operations: Float!
    financeHealth: Float!
    workforceHealth: Float!
  }

  type IntelligenceModule {
    insights: [Insight!]!
    confidence: Float!
    operatingSignal: String!
  }

  type Dashboard {
    tenant: String!
    generatedAt: String!
    scorecard: Scorecard!
    inventory: InventoryModule!
    hr: HrModule!
    finance: FinanceModule!
    sales: SalesModule!
    intelligence: IntelligenceModule!
    notifications: [Notification!]!
  }

  type Query {
    dashboard: Dashboard!
    inventory: InventoryModule!
    hr: HrModule!
    finance: FinanceModule!
    sales: SalesModule!
    me: User!
    users: [User!]!
  }
`);

function requireGraphqlUser(authorization?: string | string[]) {
  const user = resolveUserFromToken(authorization);
  const currentUser = user ? users.find((entry) => entry.id === user.sub) : null;

  if (!user || !currentUser || currentUser.status !== "ACTIVE" || isUserLocked(currentUser)) {
    throw new Error("Unauthorized");
  }

  return user;
}

app.get("/graphql", (_req, res) => {
  res.type("html").send(`
    <html>
      <body style="font-family: sans-serif; padding: 32px; background: #07111d; color: #f8fafc;">
        <h1>Northstar ERP GraphQL</h1>
        <p>Send an authenticated POST request to <code>/graphql</code> with a GraphQL query body.</p>
        <pre>{
  "query": "query { dashboard { tenant generatedAt } }"
}</pre>
      </body>
    </html>
  `);
});

app.post(
  "/graphql",
  createHandler({
    schema,
    context: (req) => ({
      user: requireGraphqlUser((req as { headers?: { authorization?: string | string[] } }).headers?.authorization)
    }),
    rootValue: {
      dashboard: async (_args: unknown, context: { user: TokenPayload }) => buildDashboard(context.user.tenantId),
      inventory: async (_args: unknown, context: { user: TokenPayload }) => {
        const modules = await getDomainModules(context.user.tenantId);
        return modules.inventory;
      },
      hr: async (_args: unknown, context: { user: TokenPayload }) => {
        const modules = await getDomainModules(context.user.tenantId);
        return modules.hr;
      },
      finance: async (_args: unknown, context: { user: TokenPayload }) => {
        const modules = await getDomainModules(context.user.tenantId);
        return modules.finance;
      },
      sales: async (_args: unknown, context: { user: TokenPayload }) => {
        const modules = await getDomainModules(context.user.tenantId);
        return modules.sales;
      },
      me: (_args: unknown, context: { user: TokenPayload }) => {
        const currentUser = users.find((user) => user.id === context.user.sub);
        if (!currentUser) {
          throw new Error("Unauthorized");
        }
        return sanitizeUser(currentUser);
      },
      users: (_args: unknown, context: { user: TokenPayload }) => {
        if (context.user.role !== "ADMIN") {
          throw new Error("Forbidden");
        }
        return users.map(sanitizeUser);
      }
    }
  })
);

await Promise.all([loadUsers(), loadAuditLogs()]);

app.listen(port, () => {
  console.log(`ERP gateway listening on http://localhost:${port}`);
});
