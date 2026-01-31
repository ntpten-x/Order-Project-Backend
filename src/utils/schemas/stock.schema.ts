import { z } from "zod";
import { PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";
import { uuid, money } from "./common.schema";

// Ingredients
export const ingredientIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const ingredientNameParamSchema = z.object({
    params: z.object({ ingredient_name: z.string().min(1).max(100) })
});

export const createIngredientSchema = z.object({
    body: z.object({
        ingredient_name: z.string().min(1).max(100),
        display_name: z.string().min(1).max(100),
        description: z.string().optional(),
        unit_id: uuid,
        img_url: z.string().optional().nullable(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

export const updateIngredientSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        ingredient_name: z.string().min(1).max(100).optional(),
        display_name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        unit_id: uuid.optional(),
        img_url: z.string().optional().nullable(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

// Ingredients Unit
export const ingredientUnitIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const ingredientUnitNameParamSchema = z.object({
    params: z.object({ unit_name: z.string().min(1).max(100) })
});

export const createIngredientUnitSchema = z.object({
    body: z.object({
        unit_name: z.string().min(1).max(100),
        display_name: z.string().min(1).max(100),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

export const updateIngredientUnitSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        unit_name: z.string().min(1).max(100).optional(),
        display_name: z.string().min(1).max(100).optional(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

// Stock Orders
const stockOrderItemSchema = z.object({
    ingredient_id: uuid,
    quantity_ordered: z.coerce.number().int().min(1)
}).passthrough();

const stockPurchaseItemSchema = z.object({
    ingredient_id: uuid,
    actual_quantity: z.coerce.number().int().min(0),
    is_purchased: z.coerce.boolean().optional()
}).passthrough();

export const stockOrderIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const createStockOrderSchema = z.object({
    body: z.object({
        ordered_by_id: uuid,
        items: z.array(stockOrderItemSchema).min(1),
        remark: z.string().optional()
    }).passthrough()
});

export const updateStockOrderSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        items: z.array(stockOrderItemSchema).min(1)
    }).passthrough()
});

export const updateStockOrderStatusSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        status: z.nativeEnum(PurchaseOrderStatus)
    }).passthrough()
});

export const confirmPurchaseSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        items: z.array(stockPurchaseItemSchema).min(1),
        purchased_by_id: uuid.optional()
    }).passthrough()
});

// Orders Detail
export const updateOrdersDetailPurchaseSchema = z.object({
    body: z.object({
        orders_item_id: uuid,
        actual_quantity: z.coerce.number().int().min(0).optional(),
        purchased_by_id: uuid,
        is_purchased: z.coerce.boolean().optional()
    }).passthrough()
});
