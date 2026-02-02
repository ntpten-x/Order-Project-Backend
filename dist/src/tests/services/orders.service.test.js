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
const vitest_1 = require("vitest");
const orders_service_1 = require("../../services/pos/orders.service");
const OrderEnums_1 = require("../../entity/pos/OrderEnums");
// Mock dependencies
vitest_1.vi.mock('../../services/socket.service');
vitest_1.vi.mock('../../services/pos/shifts.service');
(0, vitest_1.describe)('OrdersService', () => {
    let ordersService;
    let mockOrdersModel;
    (0, vitest_1.beforeEach)(() => {
        mockOrdersModel = {
            findAll: vitest_1.vi.fn(),
            findOne: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn(),
        };
        ordersService = new orders_service_1.OrdersService(mockOrdersModel);
    });
    (0, vitest_1.describe)('findAll', () => {
        (0, vitest_1.it)('should return orders list', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockOrders = [
                { id: '1', order_no: 'ORD-001', status: OrderEnums_1.OrderStatus.Pending },
                { id: '2', order_no: 'ORD-002', status: OrderEnums_1.OrderStatus.Completed },
            ];
            mockOrdersModel.findAll.mockResolvedValue({
                data: mockOrders,
                total: 2,
                page: 1,
                limit: 10,
            });
            const result = yield ordersService.findAll(1, 10);
            (0, vitest_1.expect)(result.data).toEqual(mockOrders);
            (0, vitest_1.expect)(result.total).toBe(2);
            (0, vitest_1.expect)(mockOrdersModel.findAll).toHaveBeenCalledWith(1, 10, undefined, undefined, undefined, undefined);
        }));
    });
    (0, vitest_1.describe)('create', () => {
        (0, vitest_1.it)('should create order successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockOrder = {
                id: '1',
                order_no: 'ORD-001',
                status: OrderEnums_1.OrderStatus.Pending,
            };
            mockOrdersModel.create.mockResolvedValue(mockOrder);
            mockOrdersModel.findOneByOrderNo.mockResolvedValue(null);
            const orderData = {
                order_type: 'DineIn',
                status: OrderEnums_1.OrderStatus.Pending,
            };
            // Mock transaction
            const result = yield ordersService.create(orderData);
            (0, vitest_1.expect)(result).toBeDefined();
        }));
        (0, vitest_1.it)('should throw error if order number already exists', () => __awaiter(void 0, void 0, void 0, function* () {
            mockOrdersModel.findOneByOrderNo.mockResolvedValue({ id: '1' });
            const orderData = {
                order_no: 'ORD-001',
                order_type: 'DineIn',
            };
            yield (0, vitest_1.expect)(ordersService.create(orderData)).rejects.toThrow();
        }));
    });
});
