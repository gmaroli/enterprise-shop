-- Refresh planner statistics after each load.
ANALYZE staging.stg_order;
ANALYZE staging.stg_order_item;
ANALYZE dw.dim_customer;
ANALYZE dw.dim_product;
ANALYZE dw.fact_orders;
ANALYZE dw.fact_order_lines;
