export const RealtimeEvents = {
    system: {
        announcement: "system:announcement",
    },
    users: {
        create: "users:create",
        update: "users:update",
        delete: "users:delete",
        status: "users:update-status",
    },
    roles: {
        create: "roles:create",
        update: "roles:update",
        delete: "roles:delete",
    },
    branches: {
        create: "branches:create",
        update: "branches:update",
        delete: "branches:delete",
    },
    products: {
        create: "products:create",
        update: "products:update",
        delete: "products:delete",
    },
    productsUnit: {
        create: "productsUnit:create",
        update: "productsUnit:update",
        delete: "productsUnit:delete",
    },
    categories: {
        create: "category:create",
        update: "category:update",
        delete: "category:delete",
    },
    tables: {
        create: "tables:create",
        update: "tables:update",
        delete: "tables:delete",
    },
    orders: {
        create: "orders:create",
        update: "orders:update",
        delete: "orders:delete",
    },
    payments: {
        create: "payments:create",
        update: "payments:update",
        delete: "payments:delete",
    },
    discounts: {
        create: "discounts:create",
        update: "discounts:update",
        delete: "discounts:delete",
    },
    delivery: {
        create: "delivery:create",
        update: "delivery:update",
        delete: "delivery:delete",
    },
    shifts: {
        update: "shifts:update",
    },
    orderQueue: {
        added: "order-queue:added",
        updated: "order-queue:updated",
        removed: "order-queue:removed",
        reordered: "order-queue:reordered",
    },
    paymentAccounts: {
        create: "payment-accounts:create",
        update: "payment-accounts:update",
        delete: "payment-accounts:delete",
    },
    paymentMethods: {
        create: "paymentMethod:create",
        update: "paymentMethod:update",
        delete: "paymentMethod:delete",
    },
    shopProfile: {
        update: "shopProfile:update",
    },
    printSettings: {
        update: "printSettings:update",
    },
    salesOrderItem: {
        create: "salesOrderItem:create",
        update: "salesOrderItem:update",
        delete: "salesOrderItem:delete",
    },
    salesOrderDetail: {
        create: "salesOrderDetail:create",
        update: "salesOrderDetail:update",
        delete: "salesOrderDetail:delete",
    },
    ingredients: {
        create: "ingredients:create",
        update: "ingredients:update",
        delete: "ingredients:delete",
    },
    ingredientsUnit: {
        create: "ingredientsUnit:create",
        update: "ingredientsUnit:update",
        delete: "ingredientsUnit:delete",
    },
    stock: {
        update: "stock:update",
    },
    stockOrders: {
        create: "stock:orders:create",
        update: "stock:orders:update",
        status: "stock:orders:status",
        delete: "stock:orders:delete",
        detailUpdate: "stock:orders:detail:update",
    },
} as const;

export const LegacyRealtimeEvents = {
    stockOrdersUpdated: "orders_updated",
} as const;
