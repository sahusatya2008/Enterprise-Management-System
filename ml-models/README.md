# ML Models

This folder documents the predictive layer used by `services/analytics-service`.

## Current Models

1. Sales Forecast Regression
   - Input: monthly bookings and wins
   - Method: `LinearRegression`
   - Output: next-period sales trend estimate
2. Inventory Demand Projection
   - Input: monthly demand and stock movement
   - Method: `LinearRegression`
   - Output: next-period demand estimate
3. Attrition Risk Score
   - Input: attendance, performance, productivity
   - Method: weighted rule-based score
   - Output: employee and team retention watch signal
4. Finance Risk Monitor
   - Input: margin, cash reserve, invoice aging, spend variance
   - Method: rule-based anomaly scoring
   - Output: risk flags and cost-control recommendations

## Production Extension Ideas

- Train per-tenant models on historical ERP records
- Add feature stores for labor, stock, and customer behavior signals
- Move regression baselines to Prophet, XGBoost, or LSTM when data volume justifies it
- Version models and expose performance metrics in the analytics API

