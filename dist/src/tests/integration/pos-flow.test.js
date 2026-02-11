"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
require("reflect-metadata");
const vitest_1 = require("vitest");
const dotenv = __importStar(require("dotenv"));
const database_1 = require("../../database/database");
const Users_1 = require("../../entity/Users");
const Products_1 = require("../../entity/pos/Products");
const Category_1 = require("../../entity/pos/Category");
const ProductsUnit_1 = require("../../entity/pos/ProductsUnit");
const PaymentMethod_1 = require("../../entity/pos/PaymentMethod");
const OrderEnums_1 = require("../../entity/pos/OrderEnums");
const orders_model_1 = require("../../models/pos/orders.model");
const orders_service_1 = require("../../services/pos/orders.service");
const payments_model_1 = require("../../models/pos/payments.model");
const payments_service_1 = require("../../services/pos/payments.service");
const Payments_1 = require("../../entity/pos/Payments");
const dashboard_service_1 = require("../../services/pos/dashboard.service");
const shifts_service_1 = require("../../services/pos/shifts.service");
const dbContext_1 = require("../../database/dbContext");
dotenv.config();
const ordersService = new orders_service_1.OrdersService(new orders_model_1.OrdersModels());
const paymentsService = new payments_service_1.PaymentsService(new payments_model_1.PaymentsModels());
const dashboardService = new dashboard_service_1.DashboardService();
const shiftsService = new shifts_service_1.ShiftsService();
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}
(0, vitest_1.describe)("POS critical flow (DB integration)", () => {
    (0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!database_1.AppDataSource.isInitialized) {
            yield database_1.AppDataSource.initialize();
        }
    }), 120000);
    (0, vitest_1.it)("handles cancel item -> payment -> dashboard summary consistently", () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const userRepo = database_1.AppDataSource.getRepository(Users_1.Users);
        const productRepo = database_1.AppDataSource.getRepository(Products_1.Products);
        const categoryRepo = database_1.AppDataSource.getRepository(Category_1.Category);
        const unitRepo = database_1.AppDataSource.getRepository(ProductsUnit_1.ProductsUnit);
        const paymentMethodRepo = database_1.AppDataSource.getRepository(PaymentMethod_1.PaymentMethod);
        const actor = yield userRepo
            .createQueryBuilder("u")
            .leftJoinAndSelect("u.roles", "r")
            .where("u.branch_id IS NOT NULL")
            .andWhere("u.is_use = true")
            .orderBy("u.create_date", "ASC")
            .getOne();
        (0, vitest_1.expect)(actor === null || actor === void 0 ? void 0 : actor.id).toBeTruthy();
        (0, vitest_1.expect)(actor === null || actor === void 0 ? void 0 : actor.branch_id).toBeTruthy();
        const branchId = actor.branch_id;
        const userId = actor.id;
        const runAsBranch = (fn) => { var _a, _b; return (0, dbContext_1.runWithDbContext)({ branchId, userId, role: (_a = actor.roles) === null || _a === void 0 ? void 0 : _a.roles_name, isAdmin: ((_b = actor.roles) === null || _b === void 0 ? void 0 : _b.roles_name) === "Admin" }, fn); };
        const summaryBefore = yield runAsBranch(() => __awaiter(void 0, void 0, void 0, function* () {
            const rows = yield dashboardService.getSalesSummary(todayIsoDate(), todayIsoDate(), branchId);
            return rows.reduce((sum, row) => sum + Number(row.total_sales || 0), 0);
        }));
        let product = yield productRepo.findOne({ where: { branch_id: branchId, is_active: true } });
        if (!product) {
            const now = Date.now();
            const category = yield categoryRepo.save({
                branch_id: branchId,
                category_name: `it-posflow-cat-${now}`,
                display_name: `IT POSFLOW CAT ${now}`,
                is_active: true,
            });
            const unit = yield unitRepo.save({
                branch_id: branchId,
                unit_name: `it-posflow-unit-${now}`,
                display_name: `IT POSFLOW UNIT ${now}`,
                is_active: true,
            });
            product = yield productRepo.save({
                branch_id: branchId,
                product_name: `it-posflow-product-${now}`,
                display_name: `IT POSFLOW PRODUCT ${now}`,
                description: "integration test product",
                price: 100,
                price_delivery: 100,
                cost: 50,
                category_id: category.id,
                unit_id: unit.id,
                is_active: true,
            });
        }
        let paymentMethod = yield paymentMethodRepo.findOne({
            where: { branch_id: branchId, is_active: true },
            order: { create_date: "ASC" },
        });
        if (!paymentMethod) {
            const now = Date.now();
            paymentMethod = yield paymentMethodRepo.save({
                branch_id: branchId,
                payment_method_name: `IT_CASH_${now}`,
                display_name: `IT CASH ${now}`,
                is_active: true,
            });
        }
        yield runAsBranch(() => __awaiter(void 0, void 0, void 0, function* () {
            yield shiftsService.openShift(userId, 0, branchId);
        }));
        const order = yield runAsBranch(() => __awaiter(void 0, void 0, void 0, function* () {
            return ordersService.createFullOrder({
                branch_id: branchId,
                created_by_id: userId,
                order_type: OrderEnums_1.OrderType.TakeAway,
                status: OrderEnums_1.OrderStatus.Pending,
                items: [
                    { product_id: product.id, quantity: 1 },
                    { product_id: product.id, quantity: 2 },
                ],
            }, branchId);
        }));
        const loadedOrder = yield runAsBranch(() => __awaiter(void 0, void 0, void 0, function* () { return ordersService.findOne(order.id, branchId); }));
        (0, vitest_1.expect)((_a = loadedOrder === null || loadedOrder === void 0 ? void 0 : loadedOrder.items) === null || _a === void 0 ? void 0 : _a.length).toBeGreaterThanOrEqual(2);
        const cancelItem = loadedOrder.items[1];
        yield runAsBranch(() => __awaiter(void 0, void 0, void 0, function* () { return ordersService.updateItemStatus(cancelItem.id, OrderEnums_1.OrderStatus.Cancelled, branchId); }));
        const orderAfterCancel = yield runAsBranch(() => __awaiter(void 0, void 0, void 0, function* () { return ordersService.findOne(order.id, branchId); }));
        (0, vitest_1.expect)(orderAfterCancel).toBeTruthy();
        const nonCancelledTotal = (orderAfterCancel.items || [])
            .filter((item) => item.status !== OrderEnums_1.OrderStatus.Cancelled && item.status !== OrderEnums_1.OrderStatus.cancelled)
            .reduce((sum, item) => sum + Number(item.total_price || 0), 0);
        (0, vitest_1.expect)(Number(orderAfterCancel.total_amount)).toBeCloseTo(nonCancelledTotal, 2);
        yield runAsBranch(() => __awaiter(void 0, void 0, void 0, function* () {
            return paymentsService.create({
                branch_id: branchId,
                order_id: order.id,
                payment_method_id: paymentMethod.id,
                amount: Number(orderAfterCancel.total_amount),
                amount_received: Number(orderAfterCancel.total_amount),
                status: Payments_1.PaymentStatus.Success,
            }, userId, branchId);
        }));
        const finalOrder = yield runAsBranch(() => __awaiter(void 0, void 0, void 0, function* () { return ordersService.findOne(order.id, branchId); }));
        (0, vitest_1.expect)(finalOrder === null || finalOrder === void 0 ? void 0 : finalOrder.status).toBe(OrderEnums_1.OrderStatus.Completed);
        const statuses = ((finalOrder === null || finalOrder === void 0 ? void 0 : finalOrder.items) || []).map((i) => i.status);
        (0, vitest_1.expect)(statuses).toContain(OrderEnums_1.OrderStatus.Cancelled);
        (0, vitest_1.expect)(statuses).toContain(OrderEnums_1.OrderStatus.Paid);
        const summaryAfter = yield runAsBranch(() => __awaiter(void 0, void 0, void 0, function* () {
            const rows = yield dashboardService.getSalesSummary(todayIsoDate(), todayIsoDate(), branchId);
            return rows.reduce((sum, row) => sum + Number(row.total_sales || 0), 0);
        }));
        const delta = Number(summaryAfter) - Number(summaryBefore);
        (0, vitest_1.expect)(delta).toBeGreaterThanOrEqual(Number(orderAfterCancel.total_amount) - 0.01);
        yield database_1.AppDataSource.query(`DELETE FROM payments WHERE order_id = $1`, [order.id]);
        yield database_1.AppDataSource.query(`DELETE FROM order_queue WHERE order_id = $1`, [order.id]);
        yield database_1.AppDataSource.query(`DELETE FROM sales_order_detail WHERE orders_item_id IN (SELECT id FROM sales_order_item WHERE order_id = $1)`, [order.id]);
        yield database_1.AppDataSource.query(`DELETE FROM sales_order_item WHERE order_id = $1`, [order.id]);
        yield database_1.AppDataSource.query(`DELETE FROM sales_orders WHERE id = $1`, [order.id]);
    }), 120000);
});
