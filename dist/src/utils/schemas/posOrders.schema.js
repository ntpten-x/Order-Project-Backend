"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderItemStatusSchema = exports.updateOrderItemSchema = exports.addOrderItemSchema = exports.updateOrderSchema = exports.createOrderSchema = exports.orderItemSchema = exports.orderItemDetailSchema = exports.orderItemIdParamSchema = exports.orderIdParamSchema = void 0;
const zod_1 = require("zod");
const OrderEnums_1 = require("../../entity/pos/OrderEnums");
const uuid = zod_1.z.string().uuid();
const money = zod_1.z.coerce.number().min(0);
exports.orderIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: uuid
    })
});
exports.orderItemIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        itemId: uuid
    })
});
exports.orderItemDetailSchema = zod_1.z.object({
    detail_name: zod_1.z.string().min(1),
    extra_price: zod_1.z.coerce.number().min(0).optional()
}).passthrough();
exports.orderItemSchema = zod_1.z.object({
    product_id: uuid,
    quantity: zod_1.z.coerce.number().int().min(1),
    discount_amount: zod_1.z.coerce.number().min(0).optional(),
    notes: zod_1.z.string().optional(),
    details: zod_1.z.array(exports.orderItemDetailSchema).optional()
}).passthrough();
exports.createOrderSchema = zod_1.z.object({
    body: zod_1.z.object({
        order_no: zod_1.z.string().optional(),
        order_type: zod_1.z.nativeEnum(OrderEnums_1.OrderType).optional(),
        table_id: uuid.nullable().optional(),
        delivery_id: uuid.nullable().optional(),
        delivery_code: zod_1.z.string().nullable().optional(),
        discount_id: uuid.nullable().optional(),
        created_by_id: uuid.optional(),
        status: zod_1.z.nativeEnum(OrderEnums_1.OrderStatus).optional(),
        items: zod_1.z.array(exports.orderItemSchema).optional(),
        sub_total: money.optional(),
        discount_amount: money.optional(),
        vat: money.optional(),
        total_amount: money.optional(),
        received_amount: money.optional(),
        change_amount: money.optional()
    }).passthrough()
});
exports.updateOrderSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: uuid
    }),
    body: zod_1.z.object({
        order_no: zod_1.z.string().optional(),
        order_type: zod_1.z.nativeEnum(OrderEnums_1.OrderType).optional(),
        table_id: uuid.nullable().optional(),
        delivery_id: uuid.nullable().optional(),
        delivery_code: zod_1.z.string().nullable().optional(),
        discount_id: uuid.nullable().optional(),
        status: zod_1.z.nativeEnum(OrderEnums_1.OrderStatus).optional()
    }).passthrough()
});
exports.addOrderItemSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: uuid
    }),
    body: exports.orderItemSchema
});
exports.updateOrderItemSchema = zod_1.z.object({
    params: zod_1.z.object({
        itemId: uuid
    }),
    body: zod_1.z.object({
        quantity: zod_1.z.coerce.number().int().min(1).optional(),
        notes: zod_1.z.string().optional()
    }).passthrough()
});
exports.updateOrderItemStatusSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: uuid
    }),
    body: zod_1.z.object({
        status: zod_1.z.nativeEnum(OrderEnums_1.OrderStatus)
    })
});
