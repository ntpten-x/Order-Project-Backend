# Permission Scope Audit

Generated: 2026-02-13T03:38:53.985Z

## Critical Rules Coverage

- Covered critical routes: 21
- Missing critical routes: 0

## Missing Critical Scope Middleware

_None_

## Advisory Routes Without Scope Middleware

_None_

## Advisory Routes Covered By requireBranch Guard

- src/routes/pos/category.route.ts:26 GET /:id (category.page:view)
- src/routes/pos/category.route.ts:30 PUT /:id (category.page:update)
- src/routes/pos/category.route.ts:31 DELETE /:id (category.page:delete)
- src/routes/pos/delivery.route.ts:27 GET /:id (delivery.page:view)
- src/routes/pos/delivery.route.ts:31 PUT /:id (delivery.page:update)
- src/routes/pos/delivery.route.ts:32 DELETE /:id (delivery.page:delete)
- src/routes/pos/discounts.route.ts:26 GET /:id (discounts.page:view)
- src/routes/pos/discounts.route.ts:30 PUT /:id (discounts.page:update)
- src/routes/pos/discounts.route.ts:31 DELETE /:id (discounts.page:delete)
- src/routes/pos/orderQueue.route.ts:17 PATCH /:id/status (queue.page:update)
- src/routes/pos/orderQueue.route.ts:18 DELETE /:id (queue.page:delete)
- src/routes/pos/paymentMethod.route.ts:26 GET /:id (payment_method.page:view)
- src/routes/pos/paymentMethod.route.ts:30 PUT /:id (payment_method.page:update)
- src/routes/pos/paymentMethod.route.ts:31 DELETE /:id (payment_method.page:delete)
- src/routes/pos/payments.route.ts:21 GET /:id (payments.page:view)
- src/routes/pos/payments.route.ts:24 PUT /:id (payments.page:update)
- src/routes/pos/payments.route.ts:25 DELETE /:id (payments.page:delete)
- src/routes/pos/products.route.ts:27 GET /:id (products.page:view)
- src/routes/pos/products.route.ts:31 PUT /:id (products.page:update)
- src/routes/pos/products.route.ts:32 DELETE /:id (products.page:delete)
- src/routes/pos/productsUnit.route.ts:26 GET /:id (products.page:view)
- src/routes/pos/productsUnit.route.ts:30 PUT /:id (products.page:update)
- src/routes/pos/productsUnit.route.ts:31 DELETE /:id (products.page:delete)
- src/routes/pos/salesOrderDetail.route.ts:25 GET /:id (orders.page:view)
- src/routes/pos/salesOrderDetail.route.ts:28 PUT /:id (orders.page:update)
- src/routes/pos/salesOrderDetail.route.ts:29 DELETE /:id (orders.page:delete)
- src/routes/pos/salesOrderItem.route.ts:25 GET /:id (orders.page:view)
- src/routes/pos/salesOrderItem.route.ts:28 PUT /:id (orders.page:update)
- src/routes/pos/salesOrderItem.route.ts:29 DELETE /:id (orders.page:delete)
- src/routes/pos/shifts.route.ts:24 GET /summary/:id (shifts.page:view)
- src/routes/pos/tables.route.ts:27 GET /:id (tables.page:view)
- src/routes/pos/tables.route.ts:31 PUT /:id (tables.page:update)
- src/routes/pos/tables.route.ts:32 DELETE /:id (tables.page:delete)
- src/routes/stock/ingredients.route.ts:28 GET /:id (stock.ingredients.page:view)
- src/routes/stock/ingredients.route.ts:33 PUT /:id (stock.ingredients.page:update)
- src/routes/stock/ingredients.route.ts:34 DELETE /:id (stock.ingredients.page:delete)
- src/routes/stock/ingredientsUnit.route.ts:27 GET /:id (stock.ingredients_unit.page:view)
- src/routes/stock/ingredientsUnit.route.ts:30 PUT /:id (stock.ingredients_unit.page:update)
- src/routes/stock/ingredientsUnit.route.ts:31 DELETE /:id (stock.ingredients_unit.page:delete)
- src/routes/stock/orders.route.ts:25 GET /:id (stock.orders.page:view)
- src/routes/stock/orders.route.ts:26 PUT /:id/status (stock.orders.page:update)
- src/routes/stock/orders.route.ts:27 PUT /:id (stock.orders.page:update)
- src/routes/stock/orders.route.ts:30 POST /:id/purchase (stock.orders.page:update)
- src/routes/stock/orders.route.ts:31 DELETE /:id (stock.orders.page:delete)