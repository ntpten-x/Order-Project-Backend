import { z } from "zod";
import { DiscountType } from "../../entity/pos/Discounts";
import { TableStatus } from "../../entity/pos/Tables";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { uuid, money } from "./common.schema";
import { paymentAccountSchema } from "../../schemas/paymentAccount.schema";

// Category
export const categoryIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const categoryNameParamSchema = z.object({
    params: z.object({ category_name: z.string().min(1).max(100) })
});

export const createCategorySchema = z.object({
    body: z.object({
        category_name: z.string().min(1).max(100),
        display_name: z.string().min(1).max(100),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

export const updateCategorySchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        category_name: z.string().min(1).max(100).optional(),
        display_name: z.string().min(1).max(100).optional(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

// Products
export const productIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const productNameParamSchema = z.object({
    params: z.object({ product_name: z.string().min(1).max(100) })
});

export const createProductSchema = z.object({
    body: z.object({
        product_name: z.string().min(1).max(100),
        display_name: z.string().min(1).max(100),
        description: z.string().optional(),
        price: money.optional(),
        price_delivery: money.optional(),
        cost: money.optional(),
        category_id: uuid,
        unit_id: uuid,
        img_url: z.string().optional().nullable(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

export const updateProductSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        product_name: z.string().min(1).max(100).optional(),
        display_name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        price: money.optional(),
        price_delivery: money.optional(),
        cost: money.optional(),
        category_id: uuid.optional(),
        unit_id: uuid.optional(),
        img_url: z.string().optional().nullable(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

// Products Unit
export const productsUnitIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const productsUnitNameParamSchema = z.object({
    params: z.object({ unit_name: z.string().min(1).max(100) })
});

export const createProductsUnitSchema = z.object({
    body: z.object({
        unit_name: z.string().min(1).max(100),
        display_name: z.string().min(1).max(100),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

export const updateProductsUnitSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        unit_name: z.string().min(1).max(100).optional(),
        display_name: z.string().min(1).max(100).optional(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

// Tables
export const tableIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const tableNameParamSchema = z.object({
    params: z.object({ name: z.string().min(1).max(255) })
});

export const createTableSchema = z.object({
    body: z.object({
        table_name: z.string().min(1).max(255),
        branch_id: uuid.optional(),
        status: z.nativeEnum(TableStatus).optional(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

export const updateTableSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        table_name: z.string().min(1).max(255).optional(),
        branch_id: uuid.optional(),
        status: z.nativeEnum(TableStatus).optional(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

// Delivery
export const deliveryIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const deliveryNameParamSchema = z.object({
    params: z.object({ name: z.string().min(1).max(255) })
});

export const createDeliverySchema = z.object({
    body: z.object({
        delivery_name: z.string().min(1).max(255),
        delivery_prefix: z.string().max(50).optional().nullable(),
        logo: z.string().optional().nullable(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

export const updateDeliverySchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        delivery_name: z.string().min(1).max(255).optional(),
        delivery_prefix: z.string().max(50).optional().nullable(),
        logo: z.string().optional().nullable(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

// Discounts
export const discountIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const discountNameParamSchema = z.object({
    params: z.object({ name: z.string().min(1).max(100) })
});

export const createDiscountSchema = z.object({
    body: z.object({
        discount_name: z.string().min(1).max(100),
        display_name: z.string().min(1).max(100),
        description: z.string().optional(),
        discount_amount: money,
        discount_type: z.nativeEnum(DiscountType),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

export const updateDiscountSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        discount_name: z.string().min(1).max(100).optional(),
        display_name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        discount_amount: money.optional(),
        discount_type: z.nativeEnum(DiscountType).optional(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

// Payment Method
export const paymentMethodIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const paymentMethodNameParamSchema = z.object({
    params: z.object({ name: z.string().min(1).max(100) })
});

export const createPaymentMethodSchema = z.object({
    body: z.object({
        payment_method_name: z.string().min(1).max(100),
        display_name: z.string().min(1).max(100),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

export const updatePaymentMethodSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        payment_method_name: z.string().min(1).max(100).optional(),
        display_name: z.string().min(1).max(100).optional(),
        is_active: z.coerce.boolean().optional()
    }).passthrough()
});

// Shop Profile
export const updateShopProfileSchema = z.object({
    body: z.object({
        shop_name: z.string().min(1).max(200).optional(),
        address: z.string().optional().nullable(),
        phone: z.string().max(20).optional().nullable(),
        promptpay_number: z.string().max(50).optional().nullable(),
        promptpay_name: z.string().max(200).optional().nullable(),
        bank_name: z.string().max(100).optional().nullable(),
        account_type: z.string().max(20).optional().nullable()
    }).passthrough()
});

// Shifts
export const shiftSummaryIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const openShiftSchema = z.object({
    body: z.object({
        start_amount: money
    }).passthrough()
});

export const closeShiftSchema = z.object({
    body: z.object({
        end_amount: money
    }).passthrough()
});

// Sales Order Item
export const salesOrderItemIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const createSalesOrderItemSchema = z.object({
    body: z.object({
        order_id: uuid,
        product_id: uuid,
        quantity: z.coerce.number().int().min(1),
        price: money.optional(),
        discount_amount: money.optional(),
        total_price: money.optional(),
        notes: z.string().optional(),
        status: z.nativeEnum(OrderStatus).optional()
    }).passthrough()
});

export const updateSalesOrderItemSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        quantity: z.coerce.number().int().min(1).optional(),
        price: money.optional(),
        discount_amount: money.optional(),
        total_price: money.optional(),
        notes: z.string().optional(),
        status: z.nativeEnum(OrderStatus).optional()
    }).passthrough()
});

// Sales Order Detail
export const salesOrderDetailIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const createSalesOrderDetailSchema = z.object({
    body: z.object({
        orders_item_id: uuid,
        detail_name: z.string().min(1).max(255),
        extra_price: money.optional()
    }).passthrough()
});

export const updateSalesOrderDetailSchema = z.object({
    params: z.object({ id: uuid }),
    body: z.object({
        detail_name: z.string().min(1).max(255).optional(),
        extra_price: money.optional()
    }).passthrough()
});

// Payment Accounts
export const paymentAccountIdParamSchema = z.object({
    params: z.object({ id: uuid })
});

export const createPaymentAccountSchema = z.object({
    body: paymentAccountSchema.passthrough()
});

export const updatePaymentAccountSchema = z.object({
    params: z.object({ id: uuid }),
    body: paymentAccountSchema.partial().passthrough()
});
