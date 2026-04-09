"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  createEmployee,
  createLeaveRequest,
  fetchEmployees,
  fetchLeaveRequests,
  updateEmployee,
  updateLeaveRequestStatus
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { SectionCard } from "@/components/section-card";
import type { HrEmployee, LeaveRequest } from "@/types/erp";

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60";

type EmployeeDraft = {
  name: string;
  department: string;
  role: string;
  manager: string;
  performanceScore: string;
  productivityScore: string;
  attritionRisk: string;
  salary: string;
  status: "active" | "on-leave" | "inactive";
  leaveBalance: string;
};

function buildEmployeeDrafts(employees: HrEmployee[]) {
  return employees.reduce<Record<string, EmployeeDraft>>((accumulator, employee) => {
    accumulator[employee.id] = {
      name: employee.name,
      department: employee.department,
      role: employee.role,
      manager: employee.manager,
      performanceScore: String(employee.performanceScore),
      productivityScore: String(employee.productivityScore),
      attritionRisk: String(employee.attritionRisk),
      salary: String(employee.salary ?? 0),
      status: employee.status ?? "active",
      leaveBalance: String(employee.leaveBalance ?? 12)
    };
    return accumulator;
  }, {});
}

function emptyEmployeeForm(): EmployeeDraft {
  return {
    name: "",
    department: "",
    role: "",
    manager: "",
    performanceScore: "80",
    productivityScore: "78",
    attritionRisk: "12",
    salary: "120000",
    status: "active",
    leaveBalance: "12"
  };
}

export function HrWorkspace({ onChanged }: { onChanged: () => void }) {
  const { token, user } = useAuth();
  const canManagePeople = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employeeDrafts, setEmployeeDrafts] = useState<Record<string, EmployeeDraft>>({});
  const [leaveStatusDrafts, setLeaveStatusDrafts] = useState<Record<string, LeaveRequest["status"]>>({});
  const [employeeForm, setEmployeeForm] = useState<EmployeeDraft>(emptyEmployeeForm());
  const [leaveForm, setLeaveForm] = useState({
    employeeId: "",
    startDate: "",
    endDate: "",
    reason: ""
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspace() {
    if (!token) {
      return;
    }

    const [employeePayload, leavePayload] = await Promise.all([fetchEmployees(token), fetchLeaveRequests(token)]);
    setEmployees(employeePayload);
    setLeaveRequests(leavePayload);
    setEmployeeDrafts(buildEmployeeDrafts(employeePayload));
    setLeaveStatusDrafts(
      leavePayload.reduce<Record<string, LeaveRequest["status"]>>((accumulator, request) => {
        accumulator[request.id] = request.status;
        return accumulator;
      }, {})
    );
    setLeaveForm((current) => ({
      ...current,
      employeeId: current.employeeId || employeePayload[0]?.id || ""
    }));
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await loadWorkspace();
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load HR workspace.");
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

  function updateEmployeeForm(field: keyof EmployeeDraft, value: string) {
    setEmployeeForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateEmployeeDraft(employeeId: string, field: keyof EmployeeDraft, value: string) {
    setEmployeeDrafts((current) => ({
      ...current,
      [employeeId]: {
        ...current[employeeId],
        [field]: value
      }
    }));
  }

  async function refreshWorkspace(nextMessage: string) {
    await loadWorkspace();
    onChanged();
    setSuccess(nextMessage);
  }

  async function handleCreateEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSubmitting(true);
    try {
      await createEmployee(
        {
          ...employeeForm,
          performanceScore: Number(employeeForm.performanceScore),
          productivityScore: Number(employeeForm.productivityScore),
          attritionRisk: Number(employeeForm.attritionRisk),
          salary: Number(employeeForm.salary),
          leaveBalance: Number(employeeForm.leaveBalance)
        },
        token
      );
      setEmployeeForm(emptyEmployeeForm());
      await refreshWorkspace("Employee added to HR.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create employee.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEmployee(employeeId: string) {
    if (!token) {
      return;
    }

    const draft = employeeDrafts[employeeId];
    setSubmitting(true);
    try {
      await updateEmployee(
        employeeId,
        {
          ...draft,
          performanceScore: Number(draft.performanceScore),
          productivityScore: Number(draft.productivityScore),
          attritionRisk: Number(draft.attritionRisk),
          salary: Number(draft.salary),
          leaveBalance: Number(draft.leaveBalance)
        },
        token
      );
      await refreshWorkspace("Employee record saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update employee.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateLeaveRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setSubmitting(true);
    try {
      await createLeaveRequest(leaveForm, token);
      setLeaveForm({
        employeeId: employees[0]?.id || "",
        startDate: "",
        endDate: "",
        reason: ""
      });
      await refreshWorkspace("Leave request submitted.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to submit leave request.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveLeaveRequest(leaveRequestId: string) {
    if (!token) {
      return;
    }

    setSubmitting(true);
    try {
      await updateLeaveRequestStatus(leaveRequestId, { status: leaveStatusDrafts[leaveRequestId] }, token);
      await refreshWorkspace("Leave request status updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update leave request.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-200">
        <span className="font-semibold text-white">Role permissions:</span>{" "}
        {canManagePeople
          ? "You can manage employee records, compensation signals, and approve leave."
          : "You can review the workforce directory and submit leave requests while HR changes remain manager-controlled."}
      </div>

      {error ? <div className="rounded-[24px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      {message ? <div className="rounded-[24px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <SectionCard title="Employee Intake" eyebrow="Directory and payroll management">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateEmployee}>
            {[
              { field: "name", label: "Full name", placeholder: "Mira Kapoor" },
              { field: "department", label: "Department", placeholder: "Sales" },
              { field: "role", label: "Role title", placeholder: "Customer Success Lead" },
              { field: "manager", label: "Manager", placeholder: "Jordan Lee" }
            ].map((field) => (
              <label key={field.field} className="block">
                <span className="mb-2 block text-sm text-slate-300">{field.label}</span>
                <input
                  value={employeeForm[field.field as keyof EmployeeDraft]}
                  onChange={(event) => updateEmployeeForm(field.field as keyof EmployeeDraft, event.target.value)}
                  placeholder={field.placeholder}
                  className={inputClassName}
                  disabled={!canManagePeople || submitting}
                  required
                />
              </label>
            ))}

            {[
              { field: "salary", label: "Annual salary" },
              { field: "performanceScore", label: "Performance score" },
              { field: "productivityScore", label: "Productivity score" },
              { field: "attritionRisk", label: "Attrition risk" },
              { field: "leaveBalance", label: "Leave balance" }
            ].map((field) => (
              <label key={field.field} className="block">
                <span className="mb-2 block text-sm text-slate-300">{field.label}</span>
                <input
                  type="number"
                  value={employeeForm[field.field as keyof EmployeeDraft]}
                  onChange={(event) => updateEmployeeForm(field.field as keyof EmployeeDraft, event.target.value)}
                  className={inputClassName}
                  disabled={!canManagePeople || submitting}
                  required
                />
              </label>
            ))}

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Status</span>
              <select
                value={employeeForm.status}
                onChange={(event) => updateEmployeeForm("status", event.target.value)}
                className={inputClassName}
                disabled={!canManagePeople || submitting}
              >
                <option value="active">Active</option>
                <option value="on-leave">On leave</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={!canManagePeople || submitting}
                className="w-full rounded-full border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Add employee"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Leave Desk" eyebrow="Attendance and leave workflow">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateLeaveRequest}>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-slate-300">Employee</span>
              <select
                value={leaveForm.employeeId}
                onChange={(event) => setLeaveForm((current) => ({ ...current, employeeId: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} · {employee.department}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Start date</span>
              <input
                type="date"
                value={leaveForm.startDate}
                onChange={(event) => setLeaveForm((current) => ({ ...current, startDate: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">End date</span>
              <input
                type="date"
                value={leaveForm.endDate}
                onChange={(event) => setLeaveForm((current) => ({ ...current, endDate: event.target.value }))}
                className={inputClassName}
                disabled={submitting}
                required
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm text-slate-300">Reason</span>
              <textarea
                value={leaveForm.reason}
                onChange={(event) => setLeaveForm((current) => ({ ...current, reason: event.target.value }))}
                className={`${inputClassName} min-h-28`}
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
                {submitting ? "Submitting..." : "Submit leave request"}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Workforce Directory" eyebrow="Editable employee records">
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
                <th className="pb-3">Salary</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const draft = employeeDrafts[employee.id];
                if (!draft) {
                  return null;
                }

                return (
                  <tr key={employee.id} className="border-t border-white/8 align-top">
                    <td className="py-4 min-w-[220px]">
                      <input
                        value={draft.name}
                        onChange={(event) => updateEmployeeDraft(employee.id, "name", event.target.value)}
                        className={inputClassName}
                        disabled={!canManagePeople || submitting}
                      />
                      <input
                        value={draft.role}
                        onChange={(event) => updateEmployeeDraft(employee.id, "role", event.target.value)}
                        className={`${inputClassName} mt-2`}
                        disabled={!canManagePeople || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        value={draft.department}
                        onChange={(event) => updateEmployeeDraft(employee.id, "department", event.target.value)}
                        className={inputClassName}
                        disabled={!canManagePeople || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        value={draft.manager}
                        onChange={(event) => updateEmployeeDraft(employee.id, "manager", event.target.value)}
                        className={inputClassName}
                        disabled={!canManagePeople || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        type="number"
                        value={draft.performanceScore}
                        onChange={(event) => updateEmployeeDraft(employee.id, "performanceScore", event.target.value)}
                        className={inputClassName}
                        disabled={!canManagePeople || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        type="number"
                        value={draft.productivityScore}
                        onChange={(event) => updateEmployeeDraft(employee.id, "productivityScore", event.target.value)}
                        className={inputClassName}
                        disabled={!canManagePeople || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        type="number"
                        value={draft.attritionRisk}
                        onChange={(event) => updateEmployeeDraft(employee.id, "attritionRisk", event.target.value)}
                        className={inputClassName}
                        disabled={!canManagePeople || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <input
                        type="number"
                        value={draft.salary}
                        onChange={(event) => updateEmployeeDraft(employee.id, "salary", event.target.value)}
                        className={inputClassName}
                        disabled={!canManagePeople || submitting}
                      />
                    </td>
                    <td className="py-4">
                      <select
                        value={draft.status}
                        onChange={(event) => updateEmployeeDraft(employee.id, "status", event.target.value)}
                        className={inputClassName}
                        disabled={!canManagePeople || submitting}
                      >
                        <option value="active">Active</option>
                        <option value="on-leave">On leave</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="py-4">
                      <button
                        onClick={() => void handleSaveEmployee(employee.id)}
                        disabled={!canManagePeople || submitting}
                        className="rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {employees.length === 0 && !loading ? <div className="text-sm text-slate-400">No employees added yet.</div> : null}
      </SectionCard>

      <SectionCard title="Leave Approval Queue" eyebrow="Manager workflow">
        <div className="space-y-3">
          {leaveRequests.map((request) => (
            <div key={request.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <div className="grid gap-4 md:grid-cols-[1.3fr,0.8fr,0.7fr] md:items-center">
                <div>
                  <div className="font-semibold text-white">{request.employeeName}</div>
                  <div className="mt-1 text-sm text-slate-300">
                    {request.department} · {request.startDate} to {request.endDate}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{request.reason}</div>
                </div>

                <select
                  value={leaveStatusDrafts[request.id] ?? request.status}
                  onChange={(event) =>
                    setLeaveStatusDrafts((current) => ({
                      ...current,
                      [request.id]: event.target.value as LeaveRequest["status"]
                    }))
                  }
                  className={inputClassName}
                  disabled={!canManagePeople || submitting}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>

                <button
                  onClick={() => void handleSaveLeaveRequest(request.id)}
                  disabled={!canManagePeople || submitting}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Save status
                </button>
              </div>
            </div>
          ))}
          {leaveRequests.length === 0 && !loading ? <div className="text-sm text-slate-400">No leave requests submitted yet.</div> : null}
        </div>
      </SectionCard>
    </div>
  );
}
