"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePaymentAccountSchema = exports.createPaymentAccountSchema = exports.paymentAccountIdParamSchema = exports.updateSalesOrderDetailSchema = exports.createSalesOrderDetailSchema = exports.salesOrderDetailIdParamSchema = exports.updateSalesOrderItemSchema = exports.createSalesOrderItemSchema = exports.salesOrderItemIdParamSchema = exports.closeShiftSchema = exports.openShiftSchema = exports.shiftSummaryIdParamSchema = exports.updateShopProfileSchema = exports.updatePaymentMethodSchema = exports.createPaymentMethodSchema = exports.paymentMethodNameParamSchema = exports.paymentMethodIdParamSchema = exports.updateDiscountSchema = exports.createDiscountSchema = exports.discountNameParamSchema = exports.discountIdParamSchema = exports.updateDeliverySchema = exports.createDeliverySchema = exports.deliveryNameParamSchema = exports.deliveryIdParamSchema = exports.updateTableSchema = exports.createTableSchema = exports.tableNameParamSchema = exports.tableIdParamSchema = exports.updateProductsUnitSchema = exports.createProductsUnitSchema = exports.productsUnitNameParamSchema = exports.productsUnitIdParamSchema = exports.updateProductSchema = exports.createProductSchema = exports.productNameParamSchema = exports.productIdParamSchema = exports.updateCategorySchema = exports.createCategorySchema = exports.categoryNameParamSchema = exports.categoryIdParamSchema = void 0;
const zod_1 = require("zod");
const Discounts_1 = require("../../entity/pos/Discounts");
const Tables_1 = require("../../entity/pos/Tables");
const OrderEnums_1 = require("../../entity/pos/OrderEnums");
const common_schema_1 = require("./common.schema");
const paymentAccount_schema_1 = require("../../schemas/paymentAccount.schema");
// Category
exports.categoryIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.categoryNameParamSchema = zod_1.z.object({
    params: zod_1.z.object({ category_name: zod_1.z.string().min(1).max(100) })
});
exports.createCategorySchema = zod_1.z.object({
    body: zod_1.z.object({
        category_name: zod_1.z.string().min(1).max(100),
        display_name: zod_1.z.string().min(1).max(100),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
exports.updateCategorySchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        category_name: zod_1.z.string().min(1).max(100).optional(),
        display_name: zod_1.z.string().min(1).max(100).optional(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
// Products
exports.productIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.productNameParamSchema = zod_1.z.object({
    params: zod_1.z.object({ product_name: zod_1.z.string().min(1).max(100) })
});
exports.createProductSchema = zod_1.z.object({
    body: zod_1.z.object({
        product_name: zod_1.z.string().min(1).max(100),
        display_name: zod_1.z.string().min(1).max(100),
        description: zod_1.z.string().optional(),
        price: common_schema_1.money.optional(),
        price_delivery: common_schema_1.money.optional(),
        cost: common_schema_1.money.optional(),
        category_id: common_schema_1.uuid,
        unit_id: common_schema_1.uuid,
        img_url: zod_1.z.string().optional().nullable(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
exports.updateProductSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        product_name: zod_1.z.string().min(1).max(100).optional(),
        display_name: zod_1.z.string().min(1).max(100).optional(),
        description: zod_1.z.string().optional(),
        price: common_schema_1.money.optional(),
        price_delivery: common_schema_1.money.optional(),
        cost: common_schema_1.money.optional(),
        category_id: common_schema_1.uuid.optional(),
        unit_id: common_schema_1.uuid.optional(),
        img_url: zod_1.z.string().optional().nullable(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
// Products Unit
exports.productsUnitIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.productsUnitNameParamSchema = zod_1.z.object({
    params: zod_1.z.object({ unit_name: zod_1.z.string().min(1).max(100) })
});
exports.createProductsUnitSchema = zod_1.z.object({
    body: zod_1.z.object({
        unit_name: zod_1.z.string().min(1).max(100),
        display_name: zod_1.z.string().min(1).max(100),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
exports.updateProductsUnitSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        unit_name: zod_1.z.string().min(1).max(100).optional(),
        display_name: zod_1.z.string().min(1).max(100).optional(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
// Tables
exports.tableIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.tableNameParamSchema = zod_1.z.object({
    params: zod_1.z.object({ name: zod_1.z.string().min(1).max(255) })
});
exports.createTableSchema = zod_1.z.object({
    body: zod_1.z.object({
        table_name: zod_1.z.string().min(1).max(255),
        branch_id: common_schema_1.uuid.optional(),
        status: zod_1.z.nativeEnum(Tables_1.TableStatus).optional(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
exports.updateTableSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        table_name: zod_1.z.string().min(1).max(255).optional(),
        branch_id: common_schema_1.uuid.optional(),
        status: zod_1.z.nativeEnum(Tables_1.TableStatus).optional(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
// Delivery
exports.deliveryIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.deliveryNameParamSchema = zod_1.z.object({
    params: zod_1.z.object({ name: zod_1.z.string().min(1).max(255) })
});
exports.createDeliverySchema = zod_1.z.object({
    body: zod_1.z.object({
        delivery_name: zod_1.z.string().min(1).max(255),
        delivery_prefix: zod_1.z.string().max(50).optional().nullable(),
        logo: zod_1.z.string().optional().nullable(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
exports.updateDeliverySchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        delivery_name: zod_1.z.string().min(1).max(255).optional(),
        delivery_prefix: zod_1.z.string().max(50).optional().nullable(),
        logo: zod_1.z.string().optional().nullable(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
// Discounts
exports.discountIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.discountNameParamSchema = zod_1.z.object({
    params: zod_1.z.object({ name: zod_1.z.string().min(1).max(100) })
});
exports.createDiscountSchema = zod_1.z.object({
    body: zod_1.z.object({
        discount_name: zod_1.z.string().min(1).max(100),
        display_name: zod_1.z.string().min(1).max(100),
        description: zod_1.z.string().optional(),
        discount_amount: common_schema_1.money,
        discount_type: zod_1.z.nativeEnum(Discounts_1.DiscountType),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
exports.updateDiscountSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        discount_name: zod_1.z.string().min(1).max(100).optional(),
        display_name: zod_1.z.string().min(1).max(100).optional(),
        description: zod_1.z.string().optional(),
        discount_amount: common_schema_1.money.optional(),
        discount_type: zod_1.z.nativeEnum(Discounts_1.DiscountType).optional(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
// Payment Method
exports.paymentMethodIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.paymentMethodNameParamSchema = zod_1.z.object({
    params: zod_1.z.object({ name: zod_1.z.string().min(1).max(100) })
});
exports.createPaymentMethodSchema = zod_1.z.object({
    body: zod_1.z.object({
        payment_method_name: zod_1.z.string().min(1).max(100),
        display_name: zod_1.z.string().min(1).max(100),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
exports.updatePaymentMethodSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        payment_method_name: zod_1.z.string().min(1).max(100).optional(),
        display_name: zod_1.z.string().min(1).max(100).optional(),
        is_active: zod_1.z.coerce.boolean().optional()
    }).passthrough()
});
// Shop Profile
exports.updateShopProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        shop_name: zod_1.z.string().min(1).max(200).optional(),
        address: zod_1.z.string().optional().nullable(),
        phone: zod_1.z.string().max(20).optional().nullable(),
        promptpay_number: zod_1.z.string().max(50).optional().nullable(),
        promptpay_name: zod_1.z.string().max(200).optional().nullable(),
        bank_name: zod_1.z.string().max(100).optional().nullable(),
        account_type: zod_1.z.string().max(20).optional().nullable()
    }).passthrough()
});
// Shifts
exports.shiftSummaryIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.openShiftSchema = zod_1.z.object({
    body: zod_1.z.object({
        start_amount: common_schema_1.money
    }).passthrough()
});
exports.closeShiftSchema = zod_1.z.object({
    body: zod_1.z.object({
        end_amount: common_schema_1.money
    }).passthrough()
});
// Sales Order Item
exports.salesOrderItemIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.createSalesOrderItemSchema = zod_1.z.object({
    body: zod_1.z.object({
        order_id: common_schema_1.uuid,
        product_id: common_schema_1.uuid,
        quantity: zod_1.z.coerce.number().int().min(1),
        price: common_schema_1.money.optional(),
        discount_amount: common_schema_1.money.optional(),
        total_price: common_schema_1.money.optional(),
        notes: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(OrderEnums_1.OrderStatus).optional()
    }).passthrough()
});
exports.updateSalesOrderItemSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        quantity: zod_1.z.coerce.number().int().min(1).optional(),
        price: common_schema_1.money.optional(),
        discount_amount: common_schema_1.money.optional(),
        total_price: common_schema_1.money.optional(),
        notes: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(OrderEnums_1.OrderStatus).optional()
    }).passthrough()
});
// Sales Order Detail
exports.salesOrderDetailIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.createSalesOrderDetailSchema = zod_1.z.object({
    body: zod_1.z.object({
        orders_item_id: common_schema_1.uuid,
        detail_name: zod_1.z.string().min(1).max(255),
        extra_price: common_schema_1.money.optional()
    }).passthrough()
});
exports.updateSalesOrderDetailSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: zod_1.z.object({
        detail_name: zod_1.z.string().min(1).max(255).optional(),
        extra_price: common_schema_1.money.optional()
    }).passthrough()
});
// Payment Accounts
exports.paymentAccountIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid })
});
exports.createPaymentAccountSchema = zod_1.z.object({
    body: paymentAccount_schema_1.paymentAccountSchema.passthrough()
});
exports.updatePaymentAccountSchema = zod_1.z.object({
    params: zod_1.z.object({ id: common_schema_1.uuid }),
    body: paymentAccount_schema_1.paymentAccountSchema.partial().passthrough()
});
