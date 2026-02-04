"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditActionType = void 0;
var AuditActionType;
(function (AuditActionType) {
    // Order actions
    AuditActionType["ORDER_CREATE"] = "ORDER_CREATE";
    AuditActionType["ORDER_UPDATE"] = "ORDER_UPDATE";
    AuditActionType["ORDER_DELETE"] = "ORDER_DELETE";
    AuditActionType["ORDER_STATUS_CHANGE"] = "ORDER_STATUS_CHANGE";
    AuditActionType["ORDER_CANCEL"] = "ORDER_CANCEL";
    // Payment actions
    AuditActionType["PAYMENT_CREATE"] = "PAYMENT_CREATE";
    AuditActionType["PAYMENT_UPDATE"] = "PAYMENT_UPDATE";
    AuditActionType["PAYMENT_DELETE"] = "PAYMENT_DELETE";
    AuditActionType["PAYMENT_REFUND"] = "PAYMENT_REFUND";
    AuditActionType["PAYMENT_ADJUST"] = "PAYMENT_ADJUST";
    // Item actions
    AuditActionType["ITEM_ADD"] = "ITEM_ADD";
    AuditActionType["ITEM_UPDATE"] = "ITEM_UPDATE";
    AuditActionType["ITEM_DELETE"] = "ITEM_DELETE";
    // Queue actions
    AuditActionType["QUEUE_ADD"] = "QUEUE_ADD";
    AuditActionType["QUEUE_UPDATE"] = "QUEUE_UPDATE";
    AuditActionType["QUEUE_REMOVE"] = "QUEUE_REMOVE";
    AuditActionType["QUEUE_REORDER"] = "QUEUE_REORDER";
    // Product actions
    AuditActionType["PRODUCT_CREATE"] = "PRODUCT_CREATE";
    AuditActionType["PRODUCT_UPDATE"] = "PRODUCT_UPDATE";
    AuditActionType["PRODUCT_DELETE"] = "PRODUCT_DELETE";
    // Category actions
    AuditActionType["CATEGORY_CREATE"] = "CATEGORY_CREATE";
    AuditActionType["CATEGORY_UPDATE"] = "CATEGORY_UPDATE";
    AuditActionType["CATEGORY_DELETE"] = "CATEGORY_DELETE";
    // Discount CRUD actions
    AuditActionType["DISCOUNT_CREATE"] = "DISCOUNT_CREATE";
    AuditActionType["DISCOUNT_UPDATE"] = "DISCOUNT_UPDATE";
    AuditActionType["DISCOUNT_DELETE"] = "DISCOUNT_DELETE";
    AuditActionType["DISCOUNT_APPLY"] = "DISCOUNT_APPLY";
    // Delivery actions
    AuditActionType["DELIVERY_CREATE"] = "DELIVERY_CREATE";
    AuditActionType["DELIVERY_UPDATE"] = "DELIVERY_UPDATE";
    AuditActionType["DELIVERY_DELETE"] = "DELIVERY_DELETE";
    // Table actions
    AuditActionType["TABLE_CREATE"] = "TABLE_CREATE";
    AuditActionType["TABLE_UPDATE"] = "TABLE_UPDATE";
    AuditActionType["TABLE_DELETE"] = "TABLE_DELETE";
    // Payment method CRUD actions
    AuditActionType["PAYMENT_METHOD_CREATE"] = "PAYMENT_METHOD_CREATE";
    AuditActionType["PAYMENT_METHOD_UPDATE"] = "PAYMENT_METHOD_UPDATE";
    AuditActionType["PAYMENT_METHOD_DELETE"] = "PAYMENT_METHOD_DELETE";
    // Unit actions
    AuditActionType["PRODUCTS_UNIT_CREATE"] = "PRODUCTS_UNIT_CREATE";
    AuditActionType["PRODUCTS_UNIT_UPDATE"] = "PRODUCTS_UNIT_UPDATE";
    AuditActionType["PRODUCTS_UNIT_DELETE"] = "PRODUCTS_UNIT_DELETE";
    // Payment account actions (PromptPay/Bank accounts)
    AuditActionType["PAYMENT_ACCOUNT_CREATE"] = "PAYMENT_ACCOUNT_CREATE";
    AuditActionType["PAYMENT_ACCOUNT_UPDATE"] = "PAYMENT_ACCOUNT_UPDATE";
    AuditActionType["PAYMENT_ACCOUNT_ACTIVATE"] = "PAYMENT_ACCOUNT_ACTIVATE";
    AuditActionType["PAYMENT_ACCOUNT_DELETE"] = "PAYMENT_ACCOUNT_DELETE";
    // Shop profile actions
    AuditActionType["SHOP_PROFILE_UPDATE"] = "SHOP_PROFILE_UPDATE";
    // User actions
    AuditActionType["USER_CREATE"] = "USER_CREATE";
    AuditActionType["USER_UPDATE"] = "USER_UPDATE";
    AuditActionType["USER_DELETE"] = "USER_DELETE";
    // Role actions
    AuditActionType["ROLE_CREATE"] = "ROLE_CREATE";
    AuditActionType["ROLE_UPDATE"] = "ROLE_UPDATE";
    AuditActionType["ROLE_DELETE"] = "ROLE_DELETE";
    // Branch actions
    AuditActionType["BRANCH_CREATE"] = "BRANCH_CREATE";
    AuditActionType["BRANCH_UPDATE"] = "BRANCH_UPDATE";
    AuditActionType["BRANCH_DELETE"] = "BRANCH_DELETE";
    // Stock actions
    AuditActionType["STOCK_INGREDIENT_CREATE"] = "STOCK_INGREDIENT_CREATE";
    AuditActionType["STOCK_INGREDIENT_UPDATE"] = "STOCK_INGREDIENT_UPDATE";
    AuditActionType["STOCK_INGREDIENT_DELETE"] = "STOCK_INGREDIENT_DELETE";
    AuditActionType["STOCK_INGREDIENT_UNIT_CREATE"] = "STOCK_INGREDIENT_UNIT_CREATE";
    AuditActionType["STOCK_INGREDIENT_UNIT_UPDATE"] = "STOCK_INGREDIENT_UNIT_UPDATE";
    AuditActionType["STOCK_INGREDIENT_UNIT_DELETE"] = "STOCK_INGREDIENT_UNIT_DELETE";
    AuditActionType["STOCK_ORDER_CREATE"] = "STOCK_ORDER_CREATE";
    AuditActionType["STOCK_ORDER_UPDATE"] = "STOCK_ORDER_UPDATE";
    AuditActionType["STOCK_ORDER_DELETE"] = "STOCK_ORDER_DELETE";
    AuditActionType["STOCK_ORDER_CONFIRM_PURCHASE"] = "STOCK_ORDER_CONFIRM_PURCHASE";
    AuditActionType["STOCK_ORDER_STATUS_UPDATE"] = "STOCK_ORDER_STATUS_UPDATE";
    // Shift actions
    AuditActionType["SHIFT_OPEN"] = "SHIFT_OPEN";
    AuditActionType["SHIFT_CLOSE"] = "SHIFT_CLOSE";
})(AuditActionType || (exports.AuditActionType = AuditActionType = {}));
