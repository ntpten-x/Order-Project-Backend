import { z } from "zod";
import { OrderStatus, OrderType } from "../../entity/pos/OrderEnums";

const uuid = z.string().uuid();
const money = z.coerce.number().min(0);

export const orderIdParamSchema = z.object({
    params: z.object({
        id: uuid
    })
});

export const orderItemIdParamSchema = z.object({
    params: z.object({
        itemId: uuid
    })
});

export const orderItemDetailSchema = z.object({
    detail_name: z.string().min(1),
    extra_price: z.coerce.number().min(0).optional()
}).passthrough();

export const orderItemSchema = z.object({
    product_id: uuid,
    quantity: z.coerce.number().int().min(1),
    discount_amount: z.coerce.number().min(0).optional(),
    notes: z.string().optional(),
    details: z.array(orderItemDetailSchema).optional()
}).passthrough();

export const createOrderSchema = z.object({
    body: z.object({
        order_no: z.string().optional(),
        order_type: z.nativeEnum(OrderType).optional(),
        table_id: uuid.nullable().optional(),
        delivery_id: uuid.nullable().optional(),
        delivery_code: z.string().nullable().optional(),
        discount_id: uuid.nullable().optional(),
        created_by_id: uuid.optional(),
        status: z.nativeEnum(OrderStatus).optional(),
        items: z.array(orderItemSchema).optional(),
        sub_total: money.optional(),
        discount_amount: money.optional(),
        vat: money.optional(),
        total_amount: money.optional(),
        received_amount: money.optional(),
        change_amount: money.optional()
    }).passthrough()
});

export const updateOrderSchema = z.object({
    params: z.object({
        id: uuid
    }),
    body: z.object({
        order_no: z.string().optional(),
        order_type: z.nativeEnum(OrderType).optional(),
        table_id: uuid.nullable().optional(),
        delivery_id: uuid.nullable().optional(),
        delivery_code: z.string().nullable().optional(),
        discount_id: uuid.nullable().optional(),
        status: z.nativeEnum(OrderStatus).optional()
    }).passthrough()
});

export const addOrderItemSchema = z.object({
    params: z.object({
        id: uuid
    }),
    body: orderItemSchema
});

export const updateOrderItemSchema = z.object({
    params: z.object({
        itemId: uuid
    }),
    body: z.object({
        quantity: z.coerce.number().int().min(1).optional(),
        notes: z.string().optional()
    }).passthrough()
});

export const updateOrderItemStatusSchema = z.object({
    params: z.object({
        id: uuid
    }),
    body: z.object({
        status: z.nativeEnum(OrderStatus)
    })
});
