"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrdersDetailPurchaseSchema = exports.confirmPurchaseSchema = exports.updateStockOrderStatusSchema = exports.updateStockOrderSchema = exports.createStockOrderSchema = exports.stockOrderIdParamSchema = exports.updateIngredientUnitSchema = exports.createIngredientUnitSchema = exports.ingredientUnitNameParamSchema = exports.ingredientUnitIdParamSchema = exports.updateIngredientSchema = exports.createIngredientSchema = exports.ingredientNameParamSchema = exports.ingredientIdParamSchema = void 0;
const zod_1 = require("zod");
const PurchaseOrder_1 = require("../../entity/stock/PurchaseOrder");
const common_schema_1 = require("./common.schema");
// Ingredients
exports.ingredientIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.ingredientNameParamSchema = zod_1.z.object({
    params: zod_1.z.object({ ingredient_name: zod_1.z.string().min(1).max(100) })
});
exports.createIngredientSchema = zod_1.z.object({
    body: zod_1.z.object({
        ingredient_name: zod_1.z.string().min(1).max(100),
        display_name: zod_1.z.string().min(1).max(100),
        description: zod_1.z.string().optional(),
        unit_id: common_schema_1.uuid,
        img_url: zod_1.z.string().optional().nullable(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
exports.updateIngredientSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        ingredient_name: zod_1.z.string().min(1).max(100).optional(),
        display_name: zod_1.z.string().min(1).max(100).optional(),
        description: zod_1.z.string().optional(),
        unit_id: common_schema_1.uuid.optional(),
        img_url: zod_1.z.string().optional().nullable(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
// Ingredients Unit
exports.ingredientUnitIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.ingredientUnitNameParamSchema = zod_1.z.object({
    params: zod_1.z.object({ unit_name: zod_1.z.string().min(1).max(100) })
});
exports.createIngredientUnitSchema = zod_1.z.object({
    body: zod_1.z.object({
        unit_name: zod_1.z.string().min(1).max(100),
        display_name: zod_1.z.string().min(1).max(100),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
exports.updateIngredientUnitSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        unit_name: zod_1.z.string().min(1).max(100).optional(),
        display_name: zod_1.z.string().min(1).max(100).optional(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
// Stock Orders
const stockOrderItemSchema = zod_1.z.object({
    ingredient_id: common_schema_1.uuid,
    quantity_ordered: zod_1.z.coerce.number().int().min(1)
}).passthrough();
const stockPurchaseItemSchema = zod_1.z.object({
    ingredient_id: common_schema_1.uuid,
    actual_quantity: zod_1.z.coerce.number().int().min(0),
    is_purchased: zod_1.z.coerce.boolean().optional()
}).passthrough();
exports.stockOrderIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.createStockOrderSchema = zod_1.z.object({
    body: zod_1.z.object({
        ordered_by_id: common_schema_1.uuid,
        items: zod_1.z.array(stockOrderItemSchema).min(1),
        remark: zod_1.z.string().optional()
    }).passthrough()
});
exports.updateStockOrderSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        items: zod_1.z.array(stockOrderItemSchema).min(1)
    }).passthrough()
});
exports.updateStockOrderStatusSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        status: zod_1.z.nativeEnum(PurchaseOrder_1.PurchaseOrderStatus)
    }).passthrough()
});
exports.confirmPurchaseSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        items: zod_1.z.array(stockPurchaseItemSchema).min(1),
        purchased_by_id: common_schema_1.uuid.optional()
    }).passthrough()
});
// Orders Detail
exports.updateOrdersDetailPurchaseSchema = zod_1.z.object({
    body: zod_1.z.object({
        orders_item_id: common_schema_1.uuid,
        actual_quantity: zod_1.z.coerce.number().int().min(0).optional(),
        purchased_by_id: common_schema_1.uuid,
        is_purchased: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
