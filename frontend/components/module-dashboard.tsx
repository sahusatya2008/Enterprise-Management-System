"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { fetchModule } from "@/lib/api";
import { moduleFallbacks } from "@/lib/fallback-data";
import { formatCurrency } from "@/lib/format";
import { MetricCard } from "@/components/metric-card";
import { SectionCard } from "@/components/section-card";
import { InventoryWorkspace } from "@/components/inventory-workspace";
import { HrWorkspace } from "@/components/hr-workspace";
import { FinanceWorkspace } from "@/components/finance-workspace";
import { SalesWorkspace } from "@/components/sales-workspace";
import type { FinanceModule, HrModule, InventoryModule, ModuleName, SalesModule } from "@/types/erp";
import { Boxes, IndianRupee, PackageCheck, TrendingUp, Users } from "lucide-react";

const money = formatCurrency;

function InventoryView({ data }: { data: InventoryModule }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total SKUs" value={String(data.overview.totalSkus)} hint="Active catalog footprint" icon={<Boxes className="h-5 w-5" />} />
        <MetricCard label="Stock Units" value={String(data.overview.stockUnits)} hint="Live quantity on hand" icon={<PackageCheck className="h-5 w-5" />} />
        <MetricCard label="Low Stock" value={String(data.overview.lowStockItems)} hint="Immediate replenishment watchlist" icon={<TrendingUp className="h-5 w-5" />} />
        <MetricCard label="Fulfillment" value={`${data.overview.fulfillmentRate}%`} hint="Order fill-rate" icon={<IndianRupee className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <SectionCard title="Demand Forecast" eyebrow="Inventory intelligence">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.forecast}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(2, 6, 23, 0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 18
                  }}
                />
                <Line type="monotone" dataKey="actual" stroke="#5eead4" strokeWidth={2.6} dot={false} />
                <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Warehouse Throughput" eyebrow="Live node performance">
          <div className="space-y-3">
            {data.warehouses.map((warehouse) => (
              <div key={warehouse.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{warehouse.name}</div>
                  <div className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-200">{warehouse.utilization}% utilized</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-300">
                  <div>Outbound today: {warehouse.outboundToday}</div>
                  <div>Inbound today: {warehouse.inboundToday}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Product Catalog" eyebrow="Critical replenishment table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="pb-3">SKU</th>
                <th className="pb-3">Product</th>
                <th className="pb-3">Supplier</th>
                <th className="pb-3">Stock</th>
                <th className="pb-3">Reorder</th>
                <th className="pb-3">Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((product) => (
                <tr key={product.id} className="border-t border-white/8">
                  <td className="py-4 text-slate-300">{product.sku}</td>
                  <td className="py-4">
                    <div className="font-medium text-white">{product.name}</div>
                    <div className="text-slate-400">{product.category}</div>
                  </td>
                  <td className="py-4 text-slate-300">{product.supplier}</td>
                  <td className="py-4 text-white">{product.stock}</td>
                  <td className="py-4 text-slate-300">{product.reorderPoint}</td>
                  <td className="py-4 text-primary">{product.trend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function PeopleView({ data }: { data: HrModule }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Headcount" value={String(data.overview.headcount)} hint="Active employees" icon={<Users className="h-5 w-5" />} />
        <MetricCard label="Attendance" value={`${data.overview.attendanceRate}%`} hint="Workforce presence" icon={<TrendingUp className="h-5 w-5" />} />
        <MetricCard label="Attrition Risk" value={`${data.overview.attritionRisk}%`} hint="ML-driven retention watch" icon={<Boxes className="h-5 w-5" />} />
        <MetricCard label="Payroll Burn" value={money(data.overview.payrollBurn)} hint="Monthly payroll outflow" icon={<IndianRupee className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <SectionCard title="Attendance Mix" eyebrow="Workforce behavior">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.attendance}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "rgba(2, 6, 23, 0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18 }} />
                <Bar dataKey="onsite" fill="#5eead4" radius={[10, 10, 0, 0]} />
                <Bar dataKey="remote" fill="#38bdf8" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Payroll Allocation" eyebrow="Cost by department">
          <div className="space-y-3">
            {data.payroll.map((group) => (
              <div key={group.group} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{group.group}</div>
                  <div className="text-white">{money(group.monthlyCost)}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Talent Heatmap" eyebrow="Performance and retention">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="pb-3">Employee</th>
                <th className="pb-3">Department</th>
                <th className="pb-3">Manager</th>
                <th className="pb-3">Performance</th>
                <th className="pb-3">Productivity</th>
                <th className="pb-3">Attrition</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((employee) => (
                <tr key={employee.id} className="border-t border-white/8">
                  <td className="py-4">
                    <div className="font-medium text-white">{employee.name}</div>
                    <div className="text-slate-400">{employee.role}</div>
                  </td>
                  <td className="py-4 text-slate-300">{employee.department}</td>
                  <td className="py-4 text-slate-300">{employee.manager}</td>
                  <td className="py-4 text-white">{employee.performanceScore}</td>
                  <td className="py-4 text-white">{employee.productivityScore}</td>
                  <td className="py-4 text-amber-200">{employee.attritionRisk}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function FinanceView({ data }: { data: FinanceModule }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revenue" value={money(data.overview.revenue)} hint="Current month revenue" icon={<IndianRupee className="h-5 w-5" />} />
        <MetricCard label="Expenses" value={money(data.overview.expenses)} hint="Operating cost base" icon={<Boxes className="h-5 w-5" />} />
        <MetricCard label="Margin" value={`${data.overview.margin}%`} hint="Net margin" icon={<TrendingUp className="h-5 w-5" />} />
        <MetricCard label="Cash Reserve" value={money(data.overview.cashReserve)} hint="Available working capital" icon={<PackageCheck className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <SectionCard title="Cash Flow Forecast" eyebrow="Finance projection">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.forecast}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "rgba(2, 6, 23, 0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18 }} />
                <Line type="monotone" dataKey="actual" stroke="#5eead4" strokeWidth={2.6} dot={false} />
                <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Invoice Status" eyebrow="Collections watch">
          <div className="space-y-3">
            {data.invoices.map((invoice) => (
              <div key={invoice.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{invoice.customer}</div>
                    <div className="text-sm text-slate-400">Due {invoice.dueDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-white">{money(invoice.amount)}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{invoice.status}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Ledger Snapshot" eyebrow="Recent postings">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="pb-3">Account</th>
                <th className="pb-3">Counterparty</th>
                <th className="pb-3">Direction</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Posted</th>
              </tr>
            </thead>
            <tbody>
              {data.ledger.map((entry) => (
                <tr key={entry.id} className="border-t border-white/8">
                  <td className="py-4 text-white">{entry.account}</td>
                  <td className="py-4 text-slate-300">{entry.counterparty}</td>
                  <td className="py-4 text-slate-300">{entry.direction}</td>
                  <td className="py-4 text-white">{money(entry.amount)}</td>
                  <td className="py-4 text-slate-300">{entry.postedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function SalesView({ data }: { data: SalesModule }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pipeline Value" value={money(data.overview.pipelineValue)} hint="Weighted open opportunities" icon={<TrendingUp className="h-5 w-5" />} />
        <MetricCard label="Conversion Rate" value={`${data.overview.conversionRate}%`} hint="Stage-to-win efficiency" icon={<PackageCheck className="h-5 w-5" />} />
        <MetricCard label="Won Deals" value={String(data.overview.wonDeals)} hint="This period closed-won" icon={<Boxes className="h-5 w-5" />} />
        <MetricCard label="Forecast" value={money(data.overview.forecast)} hint="Expected bookings" icon={<IndianRupee className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <SectionCard title="Bookings Trend" eyebrow="Sales forecast">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.orders}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "rgba(2, 6, 23, 0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18 }} />
                <Bar dataKey="booked" fill="#5eead4" radius={[10, 10, 0, 0]} />
                <Bar dataKey="won" fill="#38bdf8" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Top Accounts" eyebrow="CRM health">
          <div className="space-y-3">
            {data.customers.map((customer) => (
              <div key={customer.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-slate-400">Renewal: {customer.renewalMonth}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-white">{customer.healthScore}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{customer.expansionPotential}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Pipeline Table" eyebrow="Lead probability scoring">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="pb-3">Company</th>
                <th className="pb-3">Stage</th>
                <th className="pb-3">Owner</th>
                <th className="pb-3">Probability</th>
                <th className="pb-3">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.pipeline.map((lead) => (
                <tr key={lead.id} className="border-t border-white/8">
                  <td className="py-4 text-white">{lead.company}</td>
                  <td className="py-4 text-slate-300">{lead.stage}</td>
                  <td className="py-4 text-slate-300">{lead.owner}</td>
                  <td className="py-4 text-primary">{lead.probability}%</td>
                  <td className="py-4 text-white">{money(lead.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export function ModuleDashboard({ module }: { module: ModuleName }) {
  const [data, setData] = useState<InventoryModule | HrModule | FinanceModule | SalesModule>(moduleFallbacks[module]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    void fetchModule<typeof data>(module).then((payload) => {
      if (active) {
        setData(payload);
      }
    });

    return () => {
      active = false;
    };
  }, [module, refreshKey]);

  const headings: Record<ModuleName, { title: string; subtitle: string }> = {
    inventory: {
      title: "Inventory Command",
      subtitle: "Track stock, supplier signals, warehouse throughput, and demand projection."
    },
    hr: {
      title: "People Operations",
      subtitle: "Align workforce planning, productivity, payroll, and retention risk."
    },
    finance: {
      title: "Finance Control",
      subtitle: "Monitor cash flow, invoices, ledger activity, and budget pressure."
    },
    sales: {
      title: "Sales and CRM",
      subtitle: "View pipeline movement, customer health, forecast, and conversion scoring."
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 via-slate-950/40 to-transparent p-6 shadow-ambient backdrop-blur-xl">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Department dashboard</p>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight">
            {headings[module].title}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-300">{headings[module].subtitle}</p>
        </div>
      </section>

      {module === "inventory" ? <InventoryView data={data as InventoryModule} /> : null}
      {module === "hr" ? <PeopleView data={data as HrModule} /> : null}
      {module === "finance" ? <FinanceView data={data as FinanceModule} /> : null}
      {module === "sales" ? <SalesView data={data as SalesModule} /> : null}

      <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 via-slate-950/30 to-transparent p-6 shadow-ambient backdrop-blur-xl">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Operational workspace</p>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight">
            Execute real department work from this module
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Create records, update workflows, and push changes through the ERP so dashboards, forecasting, and decision intelligence stay in sync.
          </p>
        </div>
      </section>

      {module === "inventory" ? <InventoryWorkspace onChanged={() => setRefreshKey((current) => current + 1)} /> : null}
      {module === "hr" ? <HrWorkspace onChanged={() => setRefreshKey((current) => current + 1)} /> : null}
      {module === "finance" ? <FinanceWorkspace onChanged={() => setRefreshKey((current) => current + 1)} /> : null}
      {module === "sales" ? <SalesWorkspace onChanged={() => setRefreshKey((current) => current + 1)} /> : null}
    </div>
  );
}
