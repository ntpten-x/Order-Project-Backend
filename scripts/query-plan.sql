-- Query plan templates for key endpoints.
-- Replace the placeholders before running.

-- 1) Stock orders list (pending)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT o.id, o.status, o.create_date
FROM stock_orders o
WHERE o.branch_id = :branch_id
  AND o.status IN ('pending')
ORDER BY o.create_date DESC
LIMIT 50;

-- 2) Stock orders history (completed/cancelled)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT o.id, o.status, o.create_date
FROM stock_orders o
WHERE o.branch_id = :branch_id
  AND o.status IN ('completed', 'cancelled')
ORDER BY o.create_date DESC
LIMIT 50;

-- 3) Stock order details (items + ingredient)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT o.id, o.status, i.id AS item_id, i.quantity_ordered, ing.display_name
FROM stock_orders o
JOIN stock_orders_item i ON i.orders_id = o.id
LEFT JOIN stock_ingredients ing ON ing.id = i.ingredient_id
WHERE o.id = :order_id;

-- 4) POS orders list (recent)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT o.id, o.order_no, o.status, o.create_date, o.total_amount
FROM sales_orders o
WHERE o.branch_id = :branch_id
ORDER BY o.create_date DESC
LIMIT 50;

-- 5) POS order items (by order)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT i.id, i.order_id, i.product_id, i.quantity, i.price, i.total_price
FROM sales_order_item i
WHERE i.order_id = :order_id;
