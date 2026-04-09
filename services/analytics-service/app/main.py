from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="ERP Analytics Service",
    version="0.2.0",
    description="Decision intelligence, forecasting, security review, and AI guidance for the ERP platform.",
)


class DashboardPayload(BaseModel):
    tenantId: str = "northstar-holdings"
    inventory: dict[str, Any]
    hr: dict[str, Any]
    finance: dict[str, Any]
    sales: dict[str, Any]


class ScenarioInput(BaseModel):
    salesDelta: float = Field(default=0.0, description="Projected sales percentage change.")
    hiringDelta: float = Field(default=0.0, description="Projected headcount percentage change.")
    spendDelta: float = Field(default=0.0, description="Projected operating spend percentage change.")


class ScenarioRequest(BaseModel):
    dashboard: dict[str, Any]
    scenario: ScenarioInput


class CopilotRequest(BaseModel):
    dashboard: dict[str, Any]
    question: str


class EmployeeActivityRequest(BaseModel):
    user: dict[str, Any]
    activity: list[dict[str, Any]] = Field(default_factory=list)
    hrProfile: Optional[dict[str, Any]] = None


class SecurityReviewRequest(BaseModel):
    users: list[dict[str, Any]]
    auditLogs: list[dict[str, Any]] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)


class WorkbenchRequest(BaseModel):
    dashboard: dict[str, Any]
    users: list[dict[str, Any]] = Field(default_factory=list)
    auditLogs: list[dict[str, Any]] = Field(default_factory=list)


def forecast_next(values: list[float]) -> float:
    if not values:
        return 0.0

    if len(values) == 1:
        return round(values[0], 2)

    x_axis = list(range(len(values)))
    mean_x = sum(x_axis) / len(x_axis)
    mean_y = sum(values) / len(values)

    numerator = sum((x_value - mean_x) * (y_value - mean_y) for x_value, y_value in zip(x_axis, values))
    denominator = sum((x_value - mean_x) ** 2 for x_value in x_axis)
    slope = numerator / denominator if denominator else 0.0
    intercept = mean_y - (slope * mean_x)

    return round(intercept + (slope * len(values)), 2)


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def format_inr(value: float) -> str:
    return f"₹{value:,.0f}"


def format_crore(value: float) -> str:
    return f"₹{value / 10_000_000:.2f} Cr"


def classify_question(question: str) -> tuple[str, float]:
    normalized = question.lower().strip()

    if any(word in normalized for word in ["hire", "headcount", "attrition", "leave", "employee", "people"]):
        return "workforce", 0.9
    if any(word in normalized for word in ["inventory", "stock", "supplier", "warehouse", "supply chain", "reorder"]):
        return "supply-chain", 0.92
    if any(word in normalized for word in ["margin", "finance", "cost", "budget", "cash", "invoice", "ledger"]):
        return "finance", 0.91
    if any(word in normalized for word in ["sales", "forecast", "pipeline", "lead", "crm", "customer"]):
        return "sales", 0.89
    if any(word in normalized for word in ["security", "password", "access", "credential", "login"]):
        return "security", 0.88
    return "general", 0.72


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "analytics-service"}


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "name": "Northstar ERP Analytics Service",
        "status": "ok",
        "docs": {
            "health": "/health",
            "models": "/models",
            "decision_intelligence": "POST /decision-intelligence",
            "scenario_simulation": "POST /scenario-simulation",
            "copilot_query": "POST /copilot/query",
            "employee_activity_analysis": "POST /employee-activity-analysis",
            "security_review": "POST /security-review",
            "ai_workbench": "POST /ai-workbench",
        },
    }


@app.get("/models")
def model_catalog() -> dict[str, Any]:
    return {
        "models": [
            {
                "name": "sales_forecast_regression",
                "type": "LinearRegression",
                "purpose": "Time-series trend projection on monthly bookings and wins.",
            },
            {
                "name": "inventory_demand_projection",
                "type": "LinearRegression",
                "purpose": "Demand and stock pressure projection for reorder suggestions.",
            },
            {
                "name": "attrition_risk_score",
                "type": "Rule-based + weighted scoring",
                "purpose": "Employee retention risk scoring from attendance and performance signals.",
            },
            {
                "name": "finance_risk_monitor",
                "type": "Rule-based anomaly scoring",
                "purpose": "Margin, cash, and spend variance monitoring.",
            },
            {
                "name": "credential_exposure_guard",
                "type": "Rule-based security review",
                "purpose": "Privileged-access, lockout, and password-rotation monitoring.",
            },
        ]
    }


@app.post("/decision-intelligence")
def decision_intelligence(payload: DashboardPayload) -> dict[str, Any]:
    inventory_overview = payload.inventory.get("overview", {})
    hr_overview = payload.hr.get("overview", {})
    finance_overview = payload.finance.get("overview", {})
    sales_overview = payload.sales.get("overview", {})

    pipeline_pressure = float(sales_overview.get("pipelineValue", 0)) / 1_000_000
    low_stock_items = float(inventory_overview.get("lowStockItems", 0))
    attrition_risk = float(hr_overview.get("attritionRisk", 0))
    margin = float(finance_overview.get("margin", 0))

    insights = [
        {
            "title": "Scale workforce with revenue momentum",
            "summary": "Sales velocity is stronger than current operations capacity.",
            "owner": "HR + Sales",
            "impact": "Open hiring only in revenue-support and fulfillment-critical roles.",
            "confidence": 0.86,
        },
        {
            "title": "Protect supply continuity",
            "summary": "Low-stock exposure is concentrated in fast-moving lanes.",
            "owner": "Inventory",
            "impact": "Advance replenishment on suppliers tied to high-demand SKUs.",
            "confidence": 0.84,
        },
        {
            "title": "Defend margin early",
            "summary": "Collections and operating spend need closer control before margins compress further.",
            "owner": "Finance",
            "impact": "Reduce non-essential spend and accelerate invoice recovery.",
            "confidence": 0.8,
        },
        {
            "title": "Stabilize commercial talent",
            "summary": "People risk in customer-facing roles can reduce forecast accuracy.",
            "owner": "HR + Sales",
            "impact": "Retain top revenue operators before adding new quota capacity.",
            "confidence": 0.78,
        },
    ]

    if low_stock_items < 10:
        insights = insights[::2]

    operating_signal = "balanced"
    if pipeline_pressure > 1.5 and low_stock_items >= 12:
        operating_signal = "growth-constrained"
    elif margin < 20:
        operating_signal = "margin-watch"
    elif attrition_risk > 15:
        operating_signal = "people-watch"

    confidence = round(
        clamp((pipeline_pressure * 0.12) + (100 - attrition_risk) * 0.005 + margin * 0.01, 0.62, 0.93), 2
    )

    return {
        "insights": insights,
        "confidence": confidence,
        "operatingSignal": operating_signal,
    }


@app.post("/scenario-simulation")
def scenario_simulation(request: ScenarioRequest) -> dict[str, Any]:
    dashboard = request.dashboard
    scenario = request.scenario

    sales_overview = dashboard.get("sales", {}).get("overview", {})
    finance_overview = dashboard.get("finance", {}).get("overview", {})
    hr_overview = dashboard.get("hr", {}).get("overview", {})

    base_forecast = float(sales_overview.get("forecast", 0))
    base_revenue = float(finance_overview.get("revenue", 0))
    base_expenses = float(finance_overview.get("expenses", 0))
    headcount = float(hr_overview.get("headcount", 0))

    projected_revenue = base_revenue * (1 + (scenario.salesDelta / 100))
    projected_forecast = base_forecast * (1 + (scenario.salesDelta / 100))
    projected_expenses = base_expenses * (1 + (scenario.spendDelta / 100)) + (
        headcount * 2200 * (scenario.hiringDelta / 100)
    )
    projected_margin = ((projected_revenue - projected_expenses) / projected_revenue) * 100 if projected_revenue else 0
    projected_headcount = headcount * (1 + (scenario.hiringDelta / 100))

    return {
        "assumptions": {
            "salesDelta": scenario.salesDelta,
            "hiringDelta": scenario.hiringDelta,
            "spendDelta": scenario.spendDelta,
        },
        "projectedRevenue": round(projected_revenue, 2),
        "projectedSalesForecast": round(projected_forecast, 2),
        "projectedExpenses": round(projected_expenses, 2),
        "projectedMargin": round(projected_margin, 2),
        "projectedHeadcount": round(projected_headcount),
        "recommendation": (
            "Add only critical roles and protect working capital."
            if projected_margin > 20 and scenario.salesDelta >= 0
            else "Cut non-essential spend before expanding."
        ),
    }


@app.post("/employee-activity-analysis")
def employee_activity_analysis(request: EmployeeActivityRequest) -> dict[str, Any]:
    user = request.user
    activity = request.activity
    hr_profile = request.hrProfile or {}
    attrition_risk = float(hr_profile.get("attritionRisk", 0) or 0)
    productivity = float(hr_profile.get("productivityScore", 0) or 0)
    failed_attempts = int(user.get("failedLoginAttempts", 0) or 0)
    suspended = user.get("status") == "SUSPENDED"
    rotation_required = bool(user.get("mustRotatePassword"))

    risk_level = "low"
    if suspended or failed_attempts >= 3:
        risk_level = "high"
    elif rotation_required or attrition_risk >= 15:
        risk_level = "medium"

    activity_signal = "steady"
    if len(activity) >= 8:
        activity_signal = "high-engagement"
    elif len(activity) <= 1:
        activity_signal = "low-visibility"

    security_signal = "healthy"
    if suspended:
        security_signal = "suspended"
    elif failed_attempts >= 3:
        security_signal = "credential-watch"
    elif rotation_required:
        security_signal = "rotation-required"

    summary = f"{user.get('name', 'Employee')} is {activity_signal} with {security_signal} controls."
    if productivity:
        summary += f" Productivity is {productivity:.0f}."

    recommendations = []
    recommendations.append(
        "Rotate credentials immediately." if rotation_required else "Keep credential rotation on schedule."
    )
    recommendations.append(
        "Review manager follow-up and retention plan."
        if attrition_risk >= 15
        else "Continue routine manager coaching cadence."
    )
    recommendations.append(
        "Re-enable access only after admin approval." if suspended else "Keep access scoped to current responsibilities."
    )

    return {
        "riskLevel": risk_level,
        "executiveSummary": summary,
        "activitySignal": activity_signal,
        "securitySignal": security_signal,
        "recommendedActions": recommendations,
    }


@app.post("/security-review")
def security_review(request: SecurityReviewRequest) -> dict[str, Any]:
    locked_accounts = int(request.metrics.get("lockedAccounts", 0) or 0)
    suspended_accounts = int(request.metrics.get("suspendedAccounts", 0) or 0)
    rotation_required = int(request.metrics.get("rotationRequired", 0) or 0)
    admin_count = int(request.metrics.get("adminCount", 0) or 0)
    warnings = [entry for entry in request.auditLogs if entry.get("severity") in {"warning", "critical"}]

    overall_risk = "controlled"
    if locked_accounts or suspended_accounts or len(warnings) >= 5:
        overall_risk = "elevated"
    if admin_count >= 3 and rotation_required >= 2:
        overall_risk = "high"

    findings = [
        f"{locked_accounts} locked account(s) detected.",
        f"{suspended_accounts} suspended account(s) require review.",
        f"{rotation_required} account(s) need forced password rotation.",
        f"{admin_count} privileged admin account(s) are active.",
    ]

    return {
        "overallRisk": overall_risk,
        "summary": "Identity posture is being monitored through lockouts, privileged access, and audit anomalies.",
        "findings": findings,
        "recommendations": [
            "Rotate privileged credentials on a fixed cadence.",
            "Review warning-grade audit events daily.",
            "Keep suspended accounts out of active workflows.",
        ],
    }


@app.post("/ai-workbench")
def ai_workbench(request: WorkbenchRequest) -> dict[str, Any]:
    dashboard = request.dashboard
    inventory = dashboard.get("inventory", {}).get("overview", {})
    finance = dashboard.get("finance", {}).get("overview", {})
    hr = dashboard.get("hr", {}).get("overview", {})
    sales = dashboard.get("sales", {}).get("overview", {})
    users = request.users
    privileged_accounts = len([user for user in users if user.get("role") == "ADMIN"])
    rotation_required = len([user for user in users if user.get("mustRotatePassword")])
    warnings = len([entry for entry in request.auditLogs if entry.get("severity") in {"warning", "critical"}])
    low_stock_items = int(inventory.get("lowStockItems", 0) or 0)
    attrition_risk = float(hr.get("attritionRisk", 0) or 0)
    pipeline_value = float(sales.get("pipelineValue", 0) or 0)
    margin = float(finance.get("margin", 0) or 0)

    return {
        "tools": [
            {
                "id": "executive-brief",
                "title": "Executive Brief",
                "summary": "Cross-functional summary for leadership decisions.",
                "priority": "high",
            },
            {
                "id": "supply-chain",
                "title": "Supply Chain Advisor",
                "summary": "Demand, stock, and fulfillment alignment.",
                "priority": "high",
            },
            {
                "id": "working-capital",
                "title": "Working Capital Monitor",
                "summary": "Cash reserve, invoice, and spend pressure review.",
                "priority": "medium",
            },
            {
                "id": "workforce",
                "title": "Workforce Coach",
                "summary": "Attrition, productivity, and hiring focus.",
                "priority": "medium",
            },
            {
                "id": "security",
                "title": "Security Review",
                "summary": "Access-control and audit posture snapshot.",
                "priority": "high",
            },
            {
                "id": "revenue",
                "title": "Revenue Lens",
                "summary": "Pipeline quality, close-rate, and forecast focus.",
                "priority": "high",
            },
            {
                "id": "supplier-intelligence",
                "title": "Supplier Intelligence",
                "summary": "Supplier-risk and replenishment lane priorities.",
                "priority": "medium",
            },
            {
                "id": "policy-guard",
                "title": "Policy Guard",
                "summary": "Identity policy, password rotation, and privilege review.",
                "priority": "high",
            },
            {
                "id": "anomaly-radar",
                "title": "Anomaly Radar",
                "summary": "Cross-module warning pattern detection.",
                "priority": "medium",
            },
        ],
        "executiveBrief": {
            "summary": "Growth is intact, but operations capacity and margin discipline need active governance.",
            "recommendation": "Protect fulfillment, collections, and critical hiring first.",
        },
        "supplyChain": {
            "summary": f"{inventory.get('lowStockItems', 0)} low-stock SKU(s) are pressuring service levels.",
            "recommendation": "Increase replenishment on high-demand supplier lanes and watch warehouse utilization.",
        },
        "workingCapital": {
            "summary": f"Cash reserve is {format_inr(float(finance.get('cashReserve', 0) or 0))}.",
            "recommendation": "Accelerate pending collections before expanding discretionary spend.",
        },
        "workforce": {
            "summary": f"Attrition risk is {hr.get('attritionRisk', 0)}% across {hr.get('headcount', 0)} active employees.",
            "recommendation": "Retain high-impact operators before adding new layers of hiring.",
        },
        "revenue": {
            "summary": f"Open pipeline is {format_inr(float(sales.get('pipelineValue', 0) or 0))}.",
            "recommendation": "Prioritize late-stage deals and protect proposal turnaround time.",
        },
        "security": {
            "summary": (
                f"{privileged_accounts} admin account(s), {rotation_required} forced rotation case(s), and "
                f"{warnings} warning-grade audit event(s) are active."
            ),
            "recommendation": "Review privileged access weekly and close password-rotation actions before expanding access.",
        },
        "supplierIntelligence": {
            "summary": f"{low_stock_items} low-stock SKU(s) are the strongest signal for supplier and warehouse intervention.",
            "recommendation": "Pull forward purchase approvals on critical suppliers and rebalance receiving lanes before service slips.",
        },
        "policyGuard": {
            "summary": (
                f"Credential policy pressure is {'elevated' if rotation_required or privileged_accounts > 2 else 'stable'} "
                f"with {rotation_required} account(s) needing enforced password action."
            ),
            "recommendation": "Keep 12-character credential policy, forced rotation, and admin-role reviews on a fixed cadence.",
        },
        "anomalyRadar": {
            "summary": (
                f"Margin is {margin}% while attrition risk is {attrition_risk}% and pipeline stands at {format_inr(pipeline_value)}."
            ),
            "recommendation": "Escalate only the alerts that hit revenue, fulfillment, or privileged-access paths this week.",
        },
    }


@app.post("/copilot/query")
def copilot_query(request: CopilotRequest) -> dict[str, Any]:
    question = request.question.lower().strip()
    dashboard = request.dashboard
    sales = dashboard.get("sales", {}).get("overview", {})
    inventory = dashboard.get("inventory", {}).get("overview", {})
    finance = dashboard.get("finance", {}).get("overview", {})
    hr = dashboard.get("hr", {}).get("overview", {})
    intent, confidence = classify_question(question)

    answer = "Run hiring, inventory, and cash decisions together."
    follow_ups = [
        "What should we prioritize this week?",
        "Where is the biggest risk right now?",
        "What can improve margin fast?",
    ]

    if intent == "workforce":
        answer = (
            f"Hire only critical roles. Attrition risk is {hr.get('attritionRisk', 0)}% and headcount is "
            f"{hr.get('headcount', 0)}."
        )
        follow_ups = [
            "Which department should hire first?",
            "Who needs retention action?",
            "What if hiring is delayed?",
        ]
    elif intent == "supply-chain":
        answer = (
            f"Replenish priority lanes first. {inventory.get('lowStockItems', 0)} SKU(s) are already below threshold."
        )
        follow_ups = [
            "Which supplier lane is most urgent?",
            "How does stock affect forecast?",
            "What warehouse is under pressure?",
        ]
    elif intent == "finance":
        answer = (
            f"Protect cash and margin first. Margin is {finance.get('margin', 0)}% and reserves are "
            f"{format_inr(float(finance.get('cashReserve', 0) or 0))}."
        )
        follow_ups = [
            "Where can we cut costs safely?",
            "What invoice action is urgent?",
            "What hurts margin most?",
        ]
    elif intent == "sales":
        projected = forecast_next([2.7, 2.9, 3.0, 3.2])
        answer = (
            f"Sales trend is positive. Next bookings signal is near {format_crore(projected * 10_000_000)} if execution stays stable."
        )
        follow_ups = [
            "Which deal should we protect first?",
            "What affects conversion right now?",
            "How does attrition change forecast?",
        ]
    elif intent == "security":
        answer = "Tighten credential rotation, admin access review, and lockout monitoring first."
        follow_ups = [
            "Which accounts need review?",
            "How do we reduce access risk?",
            "What is the current security posture?",
        ]

    return {
        "answer": answer,
        "suggestedFollowUps": follow_ups,
        "intent": intent,
        "confidence": round(confidence, 2),
    }
