"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  createInvoice,
  createLedgerEntry,
  fetchInvoices,
  fetchLedgerEntries,
  updateInvoice
} from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/components/auth-provider";
import { SectionCard } from "@/components/section-card";
import type { FinanceInvoice, FinanceLedgerEntry } from "@/types/erp";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60";

type InvoiceDraft = {
  customer: string;
  amount: string;
  dueDate: string;
  taxRate: string;
  status: string;
};

function buildInvoiceDrafts(invoices: FinanceInvoice[]) {
  return invoices.reduce<Record<string, InvoiceDraft>>((accumulator, invoice) => {
    accumulator[invoice.id] = {
      customer: invoice.customer,
      amount: String(invoice.amount),
      dueDate: invoice.dueDate,
      taxRate: String(invoice.taxRate ?? 18),
      status: invoice.status
    };
    return accumulator;
  }, {});
}

export function FinanceWorkspace({ onChanged }: { onChanged: () => void }) {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<FinanceLedgerEntry[]>([]);
  const [invoiceDrafts, setInvoiceDrafts] = useState<Record<string, InvoiceDraft>>({});
  const [invoiceForm, setInvoiceForm] = useState({
    customer: "",
    amount: "0",
    dueDate: "",
    taxRate: "18",
    status: "pending"
  });
  const [ledgerForm, setLedgerForm] = useState({
    account: "",
    amount: "0",
    direction: "debit",
    counterparty: "",
    postedAt: ""
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspace() {
    if (!token) {
      return;
    }

    const [invoicePayload, ledgerPayload] = await Promise.all([fetchInvoices(token), fetchLedgerEntries(token)]);
    setInvoices(invoicePayload);
    setLedgerEntries(ledgerPayload);
    setInvoiceDrafts(buildInvoiceDrafts(invoicePayload));
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await loadWorkspace();
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load finance workspace.");
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

  function setSuccess(nextMessage: string) {
    setMessage(nextMessage);
    setError(null);
  }

  async function refreshWorkspace(nextMessage: string) {
    await loadWorkspace();
    onChanged();
    setSuccess(nextMessage);
  }

  async function handleCreateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSubmitting(true);
    try {
      await createInvoice(
        {
          customer: invoiceForm.customer,
          amount: Number(invoiceForm.amount),
          dueDate: invoiceForm.dueDate,
          taxRate: Number(invoiceForm.taxRate),
          status: invoiceForm.status
        },
        token
      );
      setInvoiceForm({
        customer: "",
        amount: "0",
        dueDate: "",
        taxRate: "18",
        status: "pending"
      });
      await refreshWorkspace("Invoice created.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create invoice.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveInvoice(invoiceId: string) {
    if (!token) {
      return;
    }

    const draft = invoiceDrafts[invoiceId];
    setSubmitting(true);
    try {
      await updateInvoice(
        invoiceId,
        {
          customer: draft.customer,
          amount: Number(draft.amount),
          dueDate: draft.dueDate,
          taxRate: Number(draft.taxRate),
          status: draft.status
        },
        token
      );
      await refreshWorkspace("Invoice updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update invoice.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateLedgerEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSubmitting(true);
    try {
      await createLedgerEntry(
        {
          account: ledgerForm.account,
          amount: Number(ledgerForm.amount),
          direction: ledgerForm.direction,
          counterparty: ledgerForm.counterparty,
          postedAt: ledgerForm.postedAt
        },
        token
      );
      setLedgerForm({
        account: "",
        amount: "0",
        direction: "debit",
        counterparty: "",
        postedAt: ""
      });
      await refreshWorkspace("Ledger entry posted.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to post ledger entry.");
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
        <SectionCard title="Invoice Desk" eyebrow="Customer billing">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateInvoice}>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-slate-300">Customer</span>
              <input
                value={invoiceForm.customer}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, customer: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Amount</span>
              <input
                type="number"
                value={invoiceForm.amount}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, amount: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Tax rate</span>
              <input
                type="number"
                value={invoiceForm.taxRate}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, taxRate: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Due date</span>
              <input
                type="date"
                value={invoiceForm.dueDate}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Status</span>
              <select
                value={invoiceForm.status}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, status: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Create invoice"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Ledger Posting" eyebrow="Income and expense tracking">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateLedgerEntry}>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Account</span>
              <input
                value={ledgerForm.account}
                onChange={(event) => setLedgerForm((current) => ({ ...current, account: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Counterparty</span>
              <input
                value={ledgerForm.counterparty}
                onChange={(event) => setLedgerForm((current) => ({ ...current, counterparty: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Amount</span>
              <input
                type="number"
                value={ledgerForm.amount}
                onChange={(event) => setLedgerForm((current) => ({ ...current, amount: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Direction</span>
              <select
                value={ledgerForm.direction}
                onChange={(event) => setLedgerForm((current) => ({ ...current, direction: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-slate-300">Posting date</span>
              <input
                type="date"
                value={ledgerForm.postedAt}
                onChange={(event) => setLedgerForm((current) => ({ ...current, postedAt: event.target.value }))}
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
                {submitting ? "Posting..." : "Post ledger entry"}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Invoice Management" eyebrow="Collections and tax tracking">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="pb-3">Customer</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Due date</th>
                <th className="pb-3">Tax</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const draft = invoiceDrafts[invoice.id];
                if (!draft) {
                  return null;
                }

                return (
                  <tr key={invoice.id} className="border-t border-white/8 align-top">
                    <td className="py-4">
                      <input
                        value={draft.customer}
                        onChange={(event) =>
                          setInvoiceDrafts((current) => ({
                            ...current,
                            [invoice.id]: {
                              ...current[invoice.id],
                              customer: event.target.value
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
                        value={draft.amount}
                        onChange={(event) =>
                          setInvoiceDrafts((current) => ({
                            ...current,
                            [invoice.id]: {
                              ...current[invoice.id],
                              amount: event.target.value
                            }
                          }))
                        }
                        className={inputClassName}
                        disabled={submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        type="date"
                        value={draft.dueDate}
                        onChange={(event) =>
                          setInvoiceDrafts((current) => ({
                            ...current,
                            [invoice.id]: {
                              ...current[invoice.id],
                              dueDate: event.target.value
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
                        value={draft.taxRate}
                        onChange={(event) =>
                          setInvoiceDrafts((current) => ({
                            ...current,
                            [invoice.id]: {
                              ...current[invoice.id],
                              taxRate: event.target.value
                            }
                          }))
                        }
                        className={inputClassName}
                        disabled={submitting}
                      />
                    </td>
                    <td className="py-4">
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          setInvoiceDrafts((current) => ({
                            ...current,
                            [invoice.id]: {
                              ...current[invoice.id],
                              status: event.target.value
                            }
                          }))
                        }
                        className={inputClassName}
                        disabled={submitting}
                      >
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </td>
                    <td className="py-4">
                      <button
                        onClick={() => void handleSaveInvoice(invoice.id)}
                        disabled={submitting}
                        className="rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Save invoice
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {invoices.length === 0 && !loading ? <div className="text-sm text-slate-400">No invoices created yet.</div> : null}
      </SectionCard>

      <SectionCard title="Recent Ledger Entries" eyebrow="Accounting journal">
        <div className="space-y-3">
          {ledgerEntries.map((entry) => (
            <div key={entry.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold text-white">{entry.account}</div>
                  <div className="mt-1 text-sm text-slate-300">{entry.counterparty}</div>
                </div>
                <div className="text-sm text-slate-300">
                  {entry.direction} · {entry.postedAt}
                </div>
                <div className="text-base font-semibold text-white">{formatCurrency(entry.amount)}</div>
              </div>
            </div>
          ))}
          {ledgerEntries.length === 0 && !loading ? <div className="text-sm text-slate-400">No ledger entries posted yet.</div> : null}
        </div>
      </SectionCard>
    </div>
  );
}
