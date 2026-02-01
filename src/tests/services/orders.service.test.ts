import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrdersService } from '../../services/pos/orders.service';
import { OrdersModels } from '../../models/pos/orders.model';
import { SalesOrder } from '../../entity/pos/SalesOrder';
import { OrderStatus } from '../../entity/pos/OrderEnums';
import { AppError } from '../../utils/AppError';

// Mock dependencies
vi.mock('../../services/socket.service');
vi.mock('../../services/pos/shifts.service');

describe('OrdersService', () => {
    let ordersService: OrdersService;
    let mockOrdersModel: any;

    beforeEach(() => {
        mockOrdersModel = {
            findAll: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        };
        ordersService = new OrdersService(mockOrdersModel);
    });

    describe('findAll', () => {
        it('should return orders list', async () => {
            const mockOrders = [
                { id: '1', order_no: 'ORD-001', status: OrderStatus.Pending },
                { id: '2', order_no: 'ORD-002', status: OrderStatus.Completed },
            ];
            mockOrdersModel.findAll.mockResolvedValue({
                data: mockOrders,
                total: 2,
                page: 1,
                limit: 10,
            });

            const result = await ordersService.findAll(1, 10);

            expect(result.data).toEqual(mockOrders);
            expect(result.total).toBe(2);
            expect(mockOrdersModel.findAll).toHaveBeenCalledWith(1, 10, undefined, undefined, undefined, undefined);
        });
    });

    describe('create', () => {
        it('should create order successfully', async () => {
            const mockOrder = {
                id: '1',
                order_no: 'ORD-001',
                status: OrderStatus.Pending,
            };
            mockOrdersModel.create.mockResolvedValue(mockOrder);
            mockOrdersModel.findOneByOrderNo.mockResolvedValue(null);

            const orderData: Partial<SalesOrder> = {
                order_type: 'DineIn' as any,
                status: OrderStatus.Pending,
            };

            // Mock transaction
            const result = await ordersService.create(orderData as SalesOrder);

            expect(result).toBeDefined();
        });

        it('should throw error if order number already exists', async () => {
            mockOrdersModel.findOneByOrderNo.mockResolvedValue({ id: '1' });

            const orderData: Partial<SalesOrder> = {
                order_no: 'ORD-001',
                order_type: 'DineIn' as any,
            };

            await expect(ordersService.create(orderData as SalesOrder)).rejects.toThrow();
        });
    });
});
