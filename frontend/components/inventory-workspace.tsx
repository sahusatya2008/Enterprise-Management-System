"use client";

import { useEffect, useState } from "react";
import {
  adjustInventoryStock,
  createInventoryProduct,
  fetchInventoryProducts,
  fetchInventoryWarehouses,
  updateInventoryProduct
} from "@/lib/api";
import { SectionCard } from "@/components/section-card";
import { useAuth } from "@/components/auth-provider";
import type { InventoryProduct, InventoryWarehouse } from "@/types/erp";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60";

type ProductDraft = {
  sku: string;
  name: string;
  category: string;
  supplier: string;
  warehouse: string;
  stock: string;
  reorderPoint: string;
  unitCost: string;
  stockDelta: string;
};

function emptyForm(warehouse?: string) {
  return {
    sku: "",
    name: "",
    category: "",
    supplier: "",
    warehouse: warehouse ?? "",
    stock: "0",
    reorderPoint: "0",
    unitCost: "0"
  };
}

function buildDrafts(products: InventoryProduct[]) {
  return products.reduce<Record<string, ProductDraft>>((accumulator, product) => {
    accumulator[product.id] = {
      sku: product.sku,
      name: product.name,
      category: product.category,
      supplier: product.supplier,
      warehouse: product.warehouse,
      stock: String(product.stock),
      reorderPoint: String(product.reorderPoint),
      unitCost: String(product.unitCost),
      stockDelta: ""
    };
    return accumulator;
  }, {});
}

export function InventoryWorkspace({ onChanged }: { onChanged: () => void }) {
  const { token, user } = useAuth();
  const canManageCatalog = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canAdjustStock = Boolean(user);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProductDraft>>({});
  const [createForm, setCreateForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspace() {
    if (!token) {
      return;
    }

    const [productPayload, warehousePayload] = await Promise.all([
      fetchInventoryProducts(token),
      fetchInventoryWarehouses(token)
    ]);

    setProducts(productPayload);
    setWarehouses(warehousePayload);
    setDrafts(buildDrafts(productPayload));
    setCreateForm((current) => ({
      ...current,
      warehouse: current.warehouse || warehousePayload[0]?.name || ""
    }));
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await loadWorkspace();
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load inventory workspace.");
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

  function updateCreateForm(field: keyof typeof createForm, value: string) {
    setCreateForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateDraft(productId: string, field: keyof ProductDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [field]: value
      }
    }));
  }

  async function refreshWithMessage(nextMessage: string) {
    await loadWorkspace();
    onChanged();
    setMessage(nextMessage);
    setError(null);
  }

  async function handleCreateProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSubmitting(true);
    try {
      await createInventoryProduct(
        {
          ...createForm,
          stock: Number(createForm.stock),
          reorderPoint: Number(createForm.reorderPoint),
          unitCost: Number(createForm.unitCost)
        },
        token
      );
      setCreateForm(emptyForm(warehouses[0]?.name || createForm.warehouse));
      await refreshWithMessage("Inventory product created.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create product.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveProduct(productId: string) {
    if (!token) {
      return;
    }

    const draft = drafts[productId];
    setSubmitting(true);
    try {
      await updateInventoryProduct(
        productId,
        {
          sku: draft.sku,
          name: draft.name,
          category: draft.category,
          supplier: draft.supplier,
          warehouse: draft.warehouse,
          stock: Number(draft.stock),
          reorderPoint: Number(draft.reorderPoint),
          unitCost: Number(draft.unitCost)
        },
        token
      );
      await refreshWithMessage("Product details saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update product.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdjustStock(productId: string) {
    if (!token) {
      return;
    }

    const stockDelta = Number(drafts[productId]?.stockDelta ?? 0);
    if (!Number.isFinite(stockDelta) || stockDelta === 0) {
      setError("Enter a non-zero stock delta before applying an adjustment.");
      return;
    }

    setSubmitting(true);
    try {
      await adjustInventoryStock(productId, { delta: stockDelta }, token);
      await refreshWithMessage("Stock adjustment applied.");
    } catch (adjustError) {
      setError(adjustError instanceof Error ? adjustError.message : "Unable to adjust stock.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-200">
        <span className="font-semibold text-white">Role permissions:</span>{" "}
        {canManageCatalog
          ? "You can create catalog items, edit product masters, and adjust stock."
          : "You have operational access to adjust stock while product master data stays manager-controlled."}
      </div>

      {error ? <div className="rounded-[24px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      {message ? <div className="rounded-[24px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <SectionCard title="Catalog Intake" eyebrow="New SKU setup">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateProduct}>
            {[
              { field: "sku", label: "SKU", placeholder: "ALP-NEW-01" },
              { field: "name", label: "Product name", placeholder: "AI Warehouse Scanner" },
              { field: "category", label: "Category", placeholder: "Automation" },
              { field: "supplier", label: "Supplier", placeholder: "Nova Systems" }
            ].map((field) => (
              <label key={field.field} className="block">
                <span className="mb-2 block text-sm text-slate-300">{field.label}</span>
                <input
                  value={createForm[field.field as keyof typeof createForm]}
                  onChange={(event) => updateCreateForm(field.field as keyof typeof createForm, event.target.value)}
                  placeholder={field.placeholder}
                  className={inputClassName}
                  disabled={!canManageCatalog || submitting}
                  required
                />
              </label>
            ))}

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Warehouse</span>
              <input
                list="inventory-warehouses"
                value={createForm.warehouse}
                onChange={(event) => updateCreateForm("warehouse", event.target.value)}
                className={inputClassName}
                disabled={!canManageCatalog || submitting}
                required
              />
              <datalist id="inventory-warehouses">
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.name} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Opening stock</span>
              <input
                type="number"
                value={createForm.stock}
                onChange={(event) => updateCreateForm("stock", event.target.value)}
                className={inputClassName}
                disabled={!canManageCatalog || submitting}
                min="0"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Reorder point</span>
              <input
                type="number"
                value={createForm.reorderPoint}
                onChange={(event) => updateCreateForm("reorderPoint", event.target.value)}
                className={inputClassName}
                disabled={!canManageCatalog || submitting}
                min="0"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Unit cost</span>
              <input
                type="number"
                value={createForm.unitCost}
                onChange={(event) => updateCreateForm("unitCost", event.target.value)}
                className={inputClassName}
                disabled={!canManageCatalog || submitting}
                min="0"
                required
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={!canManageCatalog || submitting}
                className="w-full rounded-full border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Create product"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Warehouse Network" eyebrow="Live receiving and fulfillment">
          <div className="grid gap-3">
            {warehouses.map((warehouse) => (
              <div key={warehouse.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{warehouse.name}</div>
                    <div className="mt-1 text-sm text-slate-300">{warehouse.utilization}% utilized</div>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    <div>Inbound: {warehouse.inboundToday}</div>
                    <div>Outbound: {warehouse.outboundToday}</div>
                  </div>
                </div>
              </div>
            ))}
            {warehouses.length === 0 && !loading ? <div className="text-sm text-slate-400">No warehouses available yet.</div> : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Product Operations" eyebrow="Inline stock and master-data control">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="pb-3">SKU</th>
                <th className="pb-3">Name</th>
                <th className="pb-3">Supplier</th>
                <th className="pb-3">Warehouse</th>
                <th className="pb-3">Stock</th>
                <th className="pb-3">Reorder</th>
                <th className="pb-3">Cost</th>
                <th className="pb-3">Adjustment</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const draft = drafts[product.id];
                if (!draft) {
                  return null;
                }

                return (
                  <tr key={product.id} className="border-t border-white/8 align-top">
                    <td className="py-4">
                      <input
                        value={draft.sku}
                        onChange={(event) => updateDraft(product.id, "sku", event.target.value)}
                        className={inputClassName}
                        disabled={!canManageCatalog || submitting}
                      />
                    </td>
                    <td className="py-4 min-w-[220px]">
                      <input
                        value={draft.name}
                        onChange={(event) => updateDraft(product.id, "name", event.target.value)}
                        className={inputClassName}
                        disabled={!canManageCatalog || submitting}
                      />
                      <input
                        value={draft.category}
                        onChange={(event) => updateDraft(product.id, "category", event.target.value)}
                        className={`${inputClassName} mt-2`}
                        disabled={!canManageCatalog || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        value={draft.supplier}
                        onChange={(event) => updateDraft(product.id, "supplier", event.target.value)}
                        className={inputClassName}
                        disabled={!canManageCatalog || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        list="inventory-warehouses"
                        value={draft.warehouse}
                        onChange={(event) => updateDraft(product.id, "warehouse", event.target.value)}
                        className={inputClassName}
                        disabled={!canManageCatalog || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        type="number"
                        value={draft.stock}
                        onChange={(event) => updateDraft(product.id, "stock", event.target.value)}
                        className={inputClassName}
                        disabled={!canManageCatalog || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        type="number"
                        value={draft.reorderPoint}
                        onChange={(event) => updateDraft(product.id, "reorderPoint", event.target.value)}
                        className={inputClassName}
                        disabled={!canManageCatalog || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        type="number"
                        value={draft.unitCost}
                        onChange={(event) => updateDraft(product.id, "unitCost", event.target.value)}
                        className={inputClassName}
                        disabled={!canManageCatalog || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        type="number"
                        value={draft.stockDelta}
                        onChange={(event) => updateDraft(product.id, "stockDelta", event.target.value)}
                        className={inputClassName}
                        disabled={!canAdjustStock || submitting}
                        placeholder="+10 / -4"
                      />
                    </td>
                    <td className="py-4">
                      <div className="flex min-w-[150px] flex-col gap-2">
                        <button
                          onClick={() => void handleSaveProduct(product.id)}
                          disabled={!canManageCatalog || submitting}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Save details
                        </button>
                        <button
                          onClick={() => void handleAdjustStock(product.id)}
                          disabled={!canAdjustStock || submitting}
                          className="rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Apply stock move
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {products.length === 0 && !loading ? <div className="text-sm text-slate-400">No products have been added yet.</div> : null}
      </SectionCard>
    </div>
  );
}
