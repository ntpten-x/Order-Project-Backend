"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CLOSED_ORDER_STATUSES = exports.DEFAULT_ORDER_RETENTION_DAYS = void 0;
exports.cleanupClosedOrdersOlderThan = cleanupClosedOrdersOlderThan;
const dbContext_1 = require("../../database/dbContext");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
exports.DEFAULT_ORDER_RETENTION_DAYS = 30;
exports.DEFAULT_CLOSED_ORDER_STATUSES = [
    "Paid",
    "Completed",
    "Cancelled",
    // Legacy enum values (kept in OrderStatus for migration)
    "completed",
    "cancelled",
];
function toInt(value) {
    if (value === undefined || value === null)
        return undefined;
    const n = typeof value === "number" ? value : Number(String(value));
    if (!Number.isFinite(n))
        return undefined;
    return Math.trunc(n);
}
function clampInt(value, fallback, min, max) {
    const n = toInt(value);
    if (n === undefined)
        return fallback;
    return Math.min(max, Math.max(min, n));
}
function normalizeStatuses(statuses) {
    const source = statuses && statuses.length > 0 ? statuses : exports.DEFAULT_CLOSED_ORDER_STATUSES;
    const cleaned = source
        .map((s) => String(s || "").trim())
        .filter(Boolean);
    return Array.from(new Set(cleaned));
}
function countCandidates(params) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const db = (0, dbContext_1.getDbManager)();
        const rows = yield db.query(`
            SELECT COUNT(*)::int AS count
            FROM sales_orders o
            WHERE o.status::text = ANY($1::text[])
              AND o.create_date < $2
        `, [params.statuses, params.cutoffDate]);
        return Number((_b = (_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0);
    });
}
function fetchCandidateIds(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const db = (0, dbContext_1.getDbManager)();
        const rows = yield db.query(`
            SELECT o.id
            FROM sales_orders o
            WHERE o.status::text = ANY($1::text[])
              AND o.create_date < $2
            ORDER BY o.create_date ASC
            LIMIT $3
        `, [params.statuses, params.cutoffDate, params.limit]);
        return (rows !== null && rows !== void 0 ? rows : []).map((r) => String(r.id));
    });
}
function deleteByOrderIds(orderIds) {
    return __awaiter(this, void 0, void 0, function* () {
        if (orderIds.length === 0) {
            return { orders: 0, orderQueue: 0, payments: 0, items: 0, details: 0 };
        }
        return yield (0, dbContext_1.runInTransaction)((manager) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const idsParam = [orderIds];
            const orderQueueRows = yield manager.query(`
                WITH deleted AS (
                    DELETE FROM order_queue
                    WHERE order_id = ANY($1::uuid[])
                    RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM deleted
            `, idsParam);
            const orderQueue = Number((_b = (_a = orderQueueRows === null || orderQueueRows === void 0 ? void 0 : orderQueueRows[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0);
            const paymentsRows = yield manager.query(`
                WITH deleted AS (
                    DELETE FROM payments
                    WHERE order_id = ANY($1::uuid[])
                    RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM deleted
            `, idsParam);
            const payments = Number((_d = (_c = paymentsRows === null || paymentsRows === void 0 ? void 0 : paymentsRows[0]) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 0);
            const detailsRows = yield manager.query(`
                WITH deleted AS (
                    DELETE FROM sales_order_detail d
                    USING sales_order_item i
                    WHERE d.orders_item_id = i.id
                      AND i.order_id = ANY($1::uuid[])
                    RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM deleted
            `, idsParam);
            const details = Number((_f = (_e = detailsRows === null || detailsRows === void 0 ? void 0 : detailsRows[0]) === null || _e === void 0 ? void 0 : _e.count) !== null && _f !== void 0 ? _f : 0);
            const itemsRows = yield manager.query(`
                WITH deleted AS (
                    DELETE FROM sales_order_item
                    WHERE order_id = ANY($1::uuid[])
                    RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM deleted
            `, idsParam);
            const items = Number((_h = (_g = itemsRows === null || itemsRows === void 0 ? void 0 : itemsRows[0]) === null || _g === void 0 ? void 0 : _g.count) !== null && _h !== void 0 ? _h : 0);
            const ordersRows = yield manager.query(`
                WITH deleted AS (
                    DELETE FROM sales_orders
                    WHERE id = ANY($1::uuid[])
                    RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM deleted
            `, idsParam);
            const orders = Number((_k = (_j = ordersRows === null || ordersRows === void 0 ? void 0 : ordersRows[0]) === null || _j === void 0 ? void 0 : _j.count) !== null && _k !== void 0 ? _k : 0);
            return { orders, orderQueue, payments, items, details };
        }));
    });
}
function cleanupClosedOrdersOlderThan() {
    return __awaiter(this, arguments, void 0, function* (options = {}) {
        const retentionDays = clampInt(options.retentionDays, exports.DEFAULT_ORDER_RETENTION_DAYS, 1, 3650);
        const batchSize = clampInt(options.batchSize, 500, 1, 5000);
        const maxBatches = clampInt(options.maxBatches, 50, 1, 10000);
        const dryRun = Boolean(options.dryRun);
        const statuses = normalizeStatuses(options.statuses);
        const cutoffDate = new Date(Date.now() - retentionDays * MS_PER_DAY);
        return yield (0, dbContext_1.runWithDbContext)({ isAdmin: true }, () => __awaiter(this, void 0, void 0, function* () {
            const candidateOrders = yield countCandidates({ cutoffDate, statuses });
            if (dryRun || candidateOrders === 0) {
                return {
                    cutoffDate,
                    dryRun,
                    batchesProcessed: 0,
                    candidateOrders,
                    deleted: { orders: 0, orderQueue: 0, payments: 0, items: 0, details: 0 },
                };
            }
            let batchesProcessed = 0;
            const deleted = { orders: 0, orderQueue: 0, payments: 0, items: 0, details: 0 };
            for (let i = 0; i < maxBatches; i++) {
                const ids = yield fetchCandidateIds({ cutoffDate, statuses, limit: batchSize });
                if (ids.length === 0)
                    break;
                const batchDeleted = yield deleteByOrderIds(ids);
                deleted.orders += batchDeleted.orders;
                deleted.orderQueue += batchDeleted.orderQueue;
                deleted.payments += batchDeleted.payments;
                deleted.items += batchDeleted.items;
                deleted.details += batchDeleted.details;
                batchesProcessed += 1;
            }
            return {
                cutoffDate,
                dryRun,
                batchesProcessed,
                candidateOrders,
                deleted,
            };
        }));
    });
}
