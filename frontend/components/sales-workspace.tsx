"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  createCustomer,
  createLead,
  createSalesOrder,
  fetchCustomers,
  fetchLeads,
  fetchSalesOrders,
  updateLead
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { SectionCard } from "@/components/section-card";
import type { SalesCustomer, SalesLead, SalesOrder } from "@/types/erp";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60";

type LeadDraft = {
  company: string;
  stage: string;
  value: string;
  probability: string;
  owner: string;
};

function buildLeadDrafts(leads: SalesLead[]) {
  return leads.reduce<Record<string, LeadDraft>>((accumulator, lead) => {
    accumulator[lead.id] = {
      company: lead.company,
      stage: lead.stage,
      value: String(lead.value),
      probability: String(lead.probability),
      owner: lead.owner
    };
    return accumulator;
  }, {});
}

export function SalesWorkspace({ onChanged }: { onChanged: () => void }) {
  const { token } = useAuth();
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [customers, setCustomers] = useState<SalesCustomer[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [leadDrafts, setLeadDrafts] = useState<Record<string, LeadDraft>>({});
  const [leadForm, setLeadForm] = useState({
    company: "",
    stage: "Discovery",
    value: "0",
    probability: "25",
    owner: ""
  });
  const [customerForm, setCustomerForm] = useState({
    name: "",
    healthScore: "85",
    renewalMonth: "",
    expansionPotential: "medium"
  });
  const [orderForm, setOrderForm] = useState({
    month: "",
    booked: "0",
    won: "0"
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspace() {
    if (!token) {
      return;
    }

    const [leadPayload, customerPayload, orderPayload] = await Promise.all([
      fetchLeads(token),
      fetchCustomers(token),
      fetchSalesOrders(token)
    ]);
    setLeads(leadPayload);
    setCustomers(customerPayload);
    setOrders(orderPayload);
    setLeadDrafts(buildLeadDrafts(leadPayload));
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await loadWorkspace();
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load sales workspace.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  async function refreshWorkspace(nextMessage: string) {
    await loadWorkspace();
    onChanged();
    setMessage(nextMessage);
    setError(null);
  }

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSubmitting(true);
    try {
      await createLead(
        {
          company: leadForm.company,
          stage: leadForm.stage,
          value: Number(leadForm.value),
          probability: Number(leadForm.probability),
          owner: leadForm.owner
        },
        token
      );
      setLeadForm({
        company: "",
        stage: "Discovery",
        value: "0",
        probability: "25",
        owner: ""
      });
      await refreshWorkspace("Lead created.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create lead.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveLead(leadId: string) {
    if (!token) {
      return;
    }

    const draft = leadDrafts[leadId];
    setSubmitting(true);
    try {
      await updateLead(
        leadId,
        {
          company: draft.company,
          stage: draft.stage,
          value: Number(draft.value),
          probability: Number(draft.probability),
          owner: draft.owner
        },
        token
      );
      await refreshWorkspace("Lead updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update lead.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSubmitting(true);
    try {
      await createCustomer(
        {
          name: customerForm.name,
          healthScore: Number(customerForm.healthScore),
          renewalMonth: customerForm.renewalMonth,
          expansionPotential: customerForm.expansionPotential
        },
        token
      );
      setCustomerForm({
        name: "",
        healthScore: "85",
        renewalMonth: "",
        expansionPotential: "medium"
      });
      await refreshWorkspace("Customer created.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create customer.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSubmitting(true);
    try {
      await createSalesOrder(
        {
          month: orderForm.month,
          booked: Number(orderForm.booked),
          won: Number(orderForm.won)
        },
        token
      );
      setOrderForm({
        month: "",
        booked: "0",
        won: "0"
      });
      await refreshWorkspace("Order forecast record added.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create order record.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-[24px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      {message ? <div className="rounded-[24px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <SectionCard title="Lead Intake" eyebrow="Pipeline creation">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateLead}>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-slate-300">Company</span>
              <input
                value={leadForm.company}
                onChange={(event) => setLeadForm((current) => ({ ...current, company: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Stage</span>
              <select
                value={leadForm.stage}
                onChange={(event) => setLeadForm((current) => ({ ...current, stage: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
              >
                <option value="Discovery">Discovery</option>
                <option value="Proposal">Proposal</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Closed Won">Closed Won</option>
                <option value="Closed Lost">Closed Lost</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Owner</span>
              <input
                value={leadForm.owner}
                onChange={(event) => setLeadForm((current) => ({ ...current, owner: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Opportunity value</span>
              <input
                type="number"
                value={leadForm.value}
                onChange={(event) => setLeadForm((current) => ({ ...current, value: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Probability</span>
              <input
                type="number"
                value={leadForm.probability}
                onChange={(event) => setLeadForm((current) => ({ ...current, probability: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Create lead"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Customer and Orders" eyebrow="CRM + bookings">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateCustomer}>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-slate-300">Customer name</span>
              <input
                value={customerForm.name}
                onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Health score</span>
              <input
                type="number"
                value={customerForm.healthScore}
                onChange={(event) => setCustomerForm((current) => ({ ...current, healthScore: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Renewal month</span>
              <input
                value={customerForm.renewalMonth}
                onChange={(event) => setCustomerForm((current) => ({ ...current, renewalMonth: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-slate-300">Expansion potential</span>
              <select
                value={customerForm.expansionPotential}
                onChange={(event) => setCustomerForm((current) => ({ ...current, expansionPotential: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Create customer"}
              </button>
            </div>
          </form>

          <form className="mt-6 grid gap-4 md:grid-cols-3" onSubmit={handleCreateOrder}>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Month</span>
              <input
                value={orderForm.month}
                onChange={(event) => setOrderForm((current) => ({ ...current, month: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                placeholder="May"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Booked (M)</span>
              <input
                type="number"
                step="0.1"
                value={orderForm.booked}
                onChange={(event) => setOrderForm((current) => ({ ...current, booked: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Won (M)</span>
              <input
                type="number"
                step="0.1"
                value={orderForm.won}
                onChange={(event) => setOrderForm((current) => ({ ...current, won: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Add order record"}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Pipeline Management" eyebrow="Stage and probability updates">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="pb-3">Company</th>
                <th className="pb-3">Stage</th>
                <th className="pb-3">Owner</th>
                <th className="pb-3">Probability</th>
                <th className="pb-3">Value</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const draft = leadDrafts[lead.id];
                if (!draft) {
                  return null;
                }

                return (
                  <tr key={lead.id} className="border-t border-white/8 align-top">
                    <td className="py-4">
                      <input
                        value={draft.company}
                        onChange={(event) =>
                          setLeadDrafts((current) => ({
                            ...current,
                            [lead.id]: {
                              ...current[lead.id],
                              company: event.target.value
                            }
                          }))
                        }
                        className={inputClassName}
                        disabled={submitting}
                      />
                    </td>
                    <td className="py-4">
                      <select
                        value={draft.stage}
                        onChange={(event) =>
                          setLeadDrafts((current) => ({
                            ...current,
                            [lead.id]: {
                              ...current[lead.id],
                              stage: event.target.value
                            }
                          }))
                        }
                        className={inputClassName}
                        disabled={submitting}
                      >
                        <option value="Discovery">Discovery</option>
                        <option value="Proposal">Proposal</option>
                        <option value="Negotiation">Negotiation</option>
                        <option value="Closed Won">Closed Won</option>
                        <option value="Closed Lost">Closed Lost</option>
                      </select>
                    </td>
                    <td className="py-4">
                      <input
                        value={draft.owner}
                        onChange={(event) =>
                          setLeadDrafts((current) => ({
                            ...current,
                            [lead.id]: {
                              ...current[lead.id],
                              owner: event.target.value
                            }
                          }))
                        }
                        className={inputClassName}
                        disabled={submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        type="number"
                        value={draft.probability}
                        onChange={(event) =>
                          setLeadDrafts((current) => ({
                            ...current,
                            [lead.id]: {
                              ...current[lead.id],
                              probability: event.target.value
                            }
                          }))
                        }
                        className={inputClassName}
                        disabled={submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        type="number"
                        value={draft.value}
                        onChange={(event) =>
                          setLeadDrafts((current) => ({
                            ...current,
                            [lead.id]: {
                              ...current[lead.id],
                              value: event.target.value
                            }
                          }))
                        }
                        className={inputClassName}
                        disabled={submitting}
                      />
                    </td>
                    <td className="py-4">
                      <button
                        onClick={() => void handleSaveLead(lead.id)}
                        disabled={submitting}
                        className="rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Save lead
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {leads.length === 0 && !loading ? <div className="text-sm text-slate-400">No leads created yet.</div> : null}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.85fr,1.15fr]">
        <SectionCard title="Customer Portfolio" eyebrow="Health and expansion">
          <div className="space-y-3">
            {customers.map((customer) => (
              <div key={customer.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{customer.name}</div>
                    <div className="mt-1 text-sm text-slate-300">Renewal: {customer.renewalMonth}</div>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    <div>Health: {customer.healthScore}</div>
                    <div>{customer.expansionPotential} expansion</div>
                  </div>
                </div>
              </div>
            ))}
            {customers.length === 0 && !loading ? <div className="text-sm text-slate-400">No customers in CRM yet.</div> : null}
          </div>
        </SectionCard>

        <SectionCard title="Order Forecast Records" eyebrow="Bookings trend inputs">
          <div className="grid gap-3 md:grid-cols-2">
            {orders.map((order, index) => (
              <div key={order.id ?? `${order.month}-${index}`} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="font-semibold text-white">{order.month}</div>
                <div className="mt-2 text-sm text-slate-300">Booked: {order.booked}M</div>
                <div className="mt-1 text-sm text-slate-300">Won: {order.won}M</div>
              </div>
            ))}
            {orders.length === 0 && !loading ? <div className="text-sm text-slate-400">No order trend records yet.</div> : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
