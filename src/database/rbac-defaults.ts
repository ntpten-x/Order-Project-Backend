import bcrypt from "bcrypt";
import { DataSource, QueryRunner } from "typeorm";

type RoleName = "Admin" | "Manager" | "Employee";
type ResourceType = "page" | "api" | "menu" | "feature";
type ActionKey = "access" | "view" | "create" | "update" | "delete";
type Effect = "allow" | "deny";
type Scope = "none" | "own" | "branch" | "all";

type PermissionResourceRow = {
    id: string;
    resource_key: string;
    resource_type: ResourceType;
};

type PermissionActionRow = {
    id: string;
    action_key: ActionKey;
};

type RoleRow = {
    id: string;
    roles_name: RoleName;
};

type PermissionPolicy = {
    effect: Effect;
    scope: Scope;
};

const CORE_ROLES: Array<{ roleName: RoleName; displayName: string }> = [
    { roleName: "Admin", displayName: "Administrator" },
    { roleName: "Manager", displayName: "Manager" },
    { roleName: "Employee", displayName: "Employee" },
];

const ACTION_KEYS: ActionKey[] = ["access", "view", "create", "update", "delete"];

const CORE_PERMISSION_RESOURCES: Array<{
    resourceKey: string;
    resourceName: string;
    routePattern: string | null;
    resourceType: ResourceType;
    sortOrder: number;
}> = [
    { resourceKey: "menu.main.home", resourceName: "Main Menu - Home", routePattern: "/", resourceType: "menu", sortOrder: 2000 },
    { resourceKey: "menu.main.stock", resourceName: "Main Menu - Stock", routePattern: "/stock", resourceType: "menu", sortOrder: 2001 },
    { resourceKey: "menu.main.orders", resourceName: "Main Menu - Orders", routePattern: "/stock/items", resourceType: "menu", sortOrder: 2002 },
    { resourceKey: "menu.main.users", resourceName: "Main Menu - Users", routePattern: "/users", resourceType: "menu", sortOrder: 2003 },
    { resourceKey: "menu.module.pos", resourceName: "Landing Module - POS", routePattern: "/pos", resourceType: "menu", sortOrder: 2010 },
    { resourceKey: "menu.module.stock", resourceName: "Landing Module - Stock", routePattern: "/stock", resourceType: "menu", sortOrder: 2011 },
    { resourceKey: "menu.module.users", resourceName: "Landing Module - Users", routePattern: "/users", resourceType: "menu", sortOrder: 2012 },
    { resourceKey: "menu.module.branch", resourceName: "Landing Module - Branch", routePattern: "/branch", resourceType: "menu", sortOrder: 2013 },
    { resourceKey: "menu.module.audit", resourceName: "Landing Module - Audit", routePattern: "/audit", resourceType: "menu", sortOrder: 2014 },
    { resourceKey: "menu.pos.home", resourceName: "POS Menu - Home", routePattern: "/", resourceType: "menu", sortOrder: 2020 },
    { resourceKey: "menu.pos.sell", resourceName: "POS Menu - Sell", routePattern: "/pos", resourceType: "menu", sortOrder: 2021 },
    { resourceKey: "menu.pos.orders", resourceName: "POS Menu - Orders", routePattern: "/pos/orders", resourceType: "menu", sortOrder: 2022 },
    { resourceKey: "menu.pos.shift", resourceName: "POS Menu - Shift", routePattern: "/pos/shift", resourceType: "menu", sortOrder: 2024 },
    { resourceKey: "menu.pos.shiftHistory", resourceName: "POS Menu - Shift History", routePattern: "/pos/shiftHistory", resourceType: "menu", sortOrder: 2025 },
    { resourceKey: "menu.pos.dashboard", resourceName: "POS Menu - Dashboard", routePattern: "/pos/dashboard", resourceType: "menu", sortOrder: 2026 },
    { resourceKey: "menu.pos.tables", resourceName: "POS Menu - Tables", routePattern: "/pos/tables", resourceType: "menu", sortOrder: 2027 },
    { resourceKey: "menu.pos.delivery", resourceName: "POS Menu - Delivery", routePattern: "/pos/delivery", resourceType: "menu", sortOrder: 2028 },
    { resourceKey: "menu.pos.category", resourceName: "POS Menu - Category", routePattern: "/pos/category", resourceType: "menu", sortOrder: 2029 },
    { resourceKey: "menu.pos.products", resourceName: "POS Menu - Products", routePattern: "/pos/products", resourceType: "menu", sortOrder: 2030 },
    { resourceKey: "menu.pos.productsUnit", resourceName: "POS Menu - Product Units", routePattern: "/pos/productsUnit", resourceType: "menu", sortOrder: 2031 },
    { resourceKey: "menu.pos.topping", resourceName: "POS Menu - Toppings", routePattern: "/pos/topping", resourceType: "menu", sortOrder: 20315 },
    { resourceKey: "menu.pos.toppingGroup", resourceName: "POS Menu - Topping Groups", routePattern: "/pos/toppingGroup", resourceType: "menu", sortOrder: 20316 },
    { resourceKey: "menu.pos.discounts", resourceName: "POS Menu - Discounts", routePattern: "/pos/discounts", resourceType: "menu", sortOrder: 2032 },
    { resourceKey: "menu.pos.payment", resourceName: "POS Menu - Payment", routePattern: "/pos/paymentMethod", resourceType: "menu", sortOrder: 2033 },
    { resourceKey: "menu.pos.settings", resourceName: "POS Menu - Settings", routePattern: "/pos/settings", resourceType: "menu", sortOrder: 2034 },
    { resourceKey: "menu.stock.home", resourceName: "Stock Menu - Home", routePattern: "/", resourceType: "menu", sortOrder: 2040 },
    { resourceKey: "menu.stock.buying", resourceName: "Stock Menu - Buying", routePattern: "/stock", resourceType: "menu", sortOrder: 2041 },
    { resourceKey: "menu.stock.orders", resourceName: "Stock Menu - Orders", routePattern: "/stock/items", resourceType: "menu", sortOrder: 2042 },
    { resourceKey: "menu.stock.history", resourceName: "Stock Menu - History", routePattern: "/stock/history", resourceType: "menu", sortOrder: 2043 },
    { resourceKey: "menu.stock.ingredients", resourceName: "Stock Menu - Ingredients", routePattern: "/stock/ingredients", resourceType: "menu", sortOrder: 2044 },
    { resourceKey: "menu.stock.ingredientsUnit", resourceName: "Stock Menu - Ingredient Units", routePattern: "/stock/ingredientsUnit", resourceType: "menu", sortOrder: 2045 },
    { resourceKey: "menu.stock.category", resourceName: "Stock Menu - Categories", routePattern: "/stock/category", resourceType: "menu", sortOrder: 2046 },
    { resourceKey: "menu.users.home", resourceName: "Users Menu - Home", routePattern: "/", resourceType: "menu", sortOrder: 2050 },
    { resourceKey: "menu.branch.home", resourceName: "Branch Menu - Home", routePattern: "/", resourceType: "menu", sortOrder: 2051 },
    { resourceKey: "permissions.page", resourceName: "Permissions", routePattern: "/users/permissions", resourceType: "page", sortOrder: 10 },
    { resourceKey: "users.page", resourceName: "Users", routePattern: "/users", resourceType: "page", sortOrder: 11 },
    { resourceKey: "roles.page", resourceName: "Roles", routePattern: "/roles", resourceType: "page", sortOrder: 12 },
    { resourceKey: "branches.page", resourceName: "Branches", routePattern: "/branch", resourceType: "page", sortOrder: 13 },
    { resourceKey: "audit.page", resourceName: "Audit Logs", routePattern: "/audit", resourceType: "page", sortOrder: 14 },
    { resourceKey: "health_system.page", resourceName: "Health System", routePattern: "/Health-System", resourceType: "page", sortOrder: 15 },
    { resourceKey: "orders.page", resourceName: "Orders", routePattern: "/pos/orders", resourceType: "page", sortOrder: 20 },
    { resourceKey: "orders.search.feature", resourceName: "Orders - Search Orders", routePattern: "/pos/orders", resourceType: "feature", sortOrder: 20_1 },
    { resourceKey: "orders.filter.feature", resourceName: "Orders - Filter and Sort Orders", routePattern: "/pos/orders", resourceType: "feature", sortOrder: 20_2 },
    { resourceKey: "orders.summary.feature", resourceName: "Orders - View Summary and Stats", routePattern: "/pos/orders", resourceType: "feature", sortOrder: 20_3 },
    { resourceKey: "orders.detail.feature", resourceName: "Orders - Open Order Detail", routePattern: "/pos/orders/:id", resourceType: "feature", sortOrder: 20_4 },
    { resourceKey: "orders.channels.feature", resourceName: "Orders - Open Channel Workspace", routePattern: "/pos/channels", resourceType: "feature", sortOrder: 20_5 },
    { resourceKey: "orders.channel_create.feature", resourceName: "Orders - Create Order From Channel", routePattern: "/pos/channels", resourceType: "feature", sortOrder: 20_6 },
    { resourceKey: "orders.serving_board.feature", resourceName: "Orders - View Serving Board", routePattern: "/pos/list", resourceType: "feature", sortOrder: 20_7 },
    { resourceKey: "orders.serving_board_update.feature", resourceName: "Orders - Update Serving Board Status", routePattern: "/pos/list", resourceType: "feature", sortOrder: 20_8 },
    { resourceKey: "orders.line_items.feature", resourceName: "Orders - Manage Order Items", routePattern: "/pos/orders/:id", resourceType: "feature", sortOrder: 20_9 },
    { resourceKey: "orders.item_status.feature", resourceName: "Orders - Update Order Item Status", routePattern: "/pos/orders/:id", resourceType: "feature", sortOrder: 20_10 },
    { resourceKey: "orders.edit.feature", resourceName: "Orders - Edit Order Workflow", routePattern: "/pos/orders/:id", resourceType: "feature", sortOrder: 20_11 },
    { resourceKey: "orders.cancel.feature", resourceName: "Orders - Cancel Order", routePattern: "/pos/orders/:id", resourceType: "feature", sortOrder: 20_12 },
    { resourceKey: "products.page", resourceName: "Products", routePattern: "/pos/products", resourceType: "page", sortOrder: 21 },
    { resourceKey: "products.search.feature", resourceName: "Products - Search Catalog", routePattern: "/pos/products", resourceType: "feature", sortOrder: 21_1 },
    { resourceKey: "products.filter.feature", resourceName: "Products - Filter and Sort", routePattern: "/pos/products", resourceType: "feature", sortOrder: 21_2 },
    { resourceKey: "products.manager.feature", resourceName: "Products - Open Manage Workspace", routePattern: "/pos/products/manage", resourceType: "feature", sortOrder: 21_3 },
    { resourceKey: "products.create.feature", resourceName: "Products - Create Product", routePattern: "/pos/products/manage/add", resourceType: "feature", sortOrder: 21_4 },
    { resourceKey: "products.catalog.feature", resourceName: "Products - Edit Catalog Details", routePattern: "/pos/products/manage/edit", resourceType: "feature", sortOrder: 21_5 },
    { resourceKey: "products.pricing.feature", resourceName: "Products - Edit Pricing", routePattern: "/pos/products/manage/edit", resourceType: "feature", sortOrder: 21_6 },
    { resourceKey: "products.structure.feature", resourceName: "Products - Edit Category Unit and Toppings", routePattern: "/pos/products/manage/edit", resourceType: "feature", sortOrder: 21_7 },
    { resourceKey: "products.status.feature", resourceName: "Products - Toggle Active Status", routePattern: "/pos/products", resourceType: "feature", sortOrder: 21_8 },
    { resourceKey: "products.delete.feature", resourceName: "Products - Delete Product", routePattern: "/pos/products/manage/edit", resourceType: "feature", sortOrder: 21_9 },
    { resourceKey: "products_unit.page", resourceName: "Product Units", routePattern: "/pos/productsUnit", resourceType: "page", sortOrder: 22 },
    { resourceKey: "products_unit.search.feature", resourceName: "Product Units - Search Catalog", routePattern: "/pos/productsUnit", resourceType: "feature", sortOrder: 22_1 },
    { resourceKey: "products_unit.filter.feature", resourceName: "Product Units - Filter and Sort", routePattern: "/pos/productsUnit", resourceType: "feature", sortOrder: 22_2 },
    { resourceKey: "products_unit.manager.feature", resourceName: "Product Units - Open Manager Workspace", routePattern: "/pos/productsUnit/manager", resourceType: "feature", sortOrder: 22_3 },
    { resourceKey: "products_unit.create.feature", resourceName: "Product Units - Create Unit", routePattern: "/pos/productsUnit/manager/add", resourceType: "feature", sortOrder: 22_4 },
    { resourceKey: "products_unit.edit.feature", resourceName: "Product Units - Edit Unit Details", routePattern: "/pos/productsUnit/manager/edit", resourceType: "feature", sortOrder: 22_5 },
    { resourceKey: "products_unit.status.feature", resourceName: "Product Units - Toggle Active Status", routePattern: "/pos/productsUnit", resourceType: "feature", sortOrder: 22_6 },
    { resourceKey: "products_unit.delete.feature", resourceName: "Product Units - Delete Unit", routePattern: "/pos/productsUnit/manager/edit", resourceType: "feature", sortOrder: 22_7 },
    { resourceKey: "category.page", resourceName: "Category", routePattern: "/pos/category", resourceType: "page", sortOrder: 23 },
    { resourceKey: "category.search.feature", resourceName: "Category - Search Catalog", routePattern: "/pos/category", resourceType: "feature", sortOrder: 23_1 },
    { resourceKey: "category.filter.feature", resourceName: "Category - Filter and Sort", routePattern: "/pos/category", resourceType: "feature", sortOrder: 23_2 },
    { resourceKey: "category.manager.feature", resourceName: "Category - Open Manager Workspace", routePattern: "/pos/category/manager", resourceType: "feature", sortOrder: 23_3 },
    { resourceKey: "category.create.feature", resourceName: "Category - Create Category", routePattern: "/pos/category/manager/add", resourceType: "feature", sortOrder: 23_4 },
    { resourceKey: "category.edit.feature", resourceName: "Category - Edit Category Details", routePattern: "/pos/category/manager/edit", resourceType: "feature", sortOrder: 23_5 },
    { resourceKey: "category.status.feature", resourceName: "Category - Toggle Active Status", routePattern: "/pos/category", resourceType: "feature", sortOrder: 23_6 },
    { resourceKey: "category.delete.feature", resourceName: "Category - Delete Category", routePattern: "/pos/category/manager/edit", resourceType: "feature", sortOrder: 23_7 },
    { resourceKey: "topping.page", resourceName: "Toppings", routePattern: "/pos/topping", resourceType: "page", sortOrder: 24 },
    { resourceKey: "topping.search.feature", resourceName: "Toppings - Search Catalog", routePattern: "/pos/topping", resourceType: "feature", sortOrder: 24_1 },
    { resourceKey: "topping.filter.feature", resourceName: "Toppings - Filter and Sort", routePattern: "/pos/topping", resourceType: "feature", sortOrder: 24_2 },
    { resourceKey: "topping.manager.feature", resourceName: "Toppings - Open Manager Workspace", routePattern: "/pos/topping/manager", resourceType: "feature", sortOrder: 24_3 },
    { resourceKey: "topping.create.feature", resourceName: "Toppings - Create Topping", routePattern: "/pos/topping/manager/add", resourceType: "feature", sortOrder: 24_4 },
    { resourceKey: "topping.catalog.feature", resourceName: "Toppings - Edit Catalog Details", routePattern: "/pos/topping/manager/edit", resourceType: "feature", sortOrder: 24_5 },
    { resourceKey: "topping.pricing.feature", resourceName: "Toppings - Edit Pricing", routePattern: "/pos/topping/manager/edit", resourceType: "feature", sortOrder: 24_6 },
    { resourceKey: "topping.status.feature", resourceName: "Toppings - Toggle Active Status", routePattern: "/pos/topping", resourceType: "feature", sortOrder: 24_7 },
    { resourceKey: "topping.delete.feature", resourceName: "Toppings - Delete Topping", routePattern: "/pos/topping/manager/edit", resourceType: "feature", sortOrder: 24_8 },
    { resourceKey: "topping_group.page", resourceName: "Topping Groups", routePattern: "/pos/toppingGroup", resourceType: "page", sortOrder: 24_9 },
    { resourceKey: "topping_group.search.feature", resourceName: "Topping Groups - Search Catalog", routePattern: "/pos/toppingGroup", resourceType: "feature", sortOrder: 24_91 },
    { resourceKey: "topping_group.filter.feature", resourceName: "Topping Groups - Filter and Sort", routePattern: "/pos/toppingGroup", resourceType: "feature", sortOrder: 24_92 },
    { resourceKey: "topping_group.manager.feature", resourceName: "Topping Groups - Open Manager Workspace", routePattern: "/pos/toppingGroup/manager", resourceType: "feature", sortOrder: 24_93 },
    { resourceKey: "topping_group.create.feature", resourceName: "Topping Groups - Create Group", routePattern: "/pos/toppingGroup/manager/add", resourceType: "feature", sortOrder: 24_94 },
    { resourceKey: "topping_group.edit.feature", resourceName: "Topping Groups - Edit Group Details", routePattern: "/pos/toppingGroup/manager/edit", resourceType: "feature", sortOrder: 24_95 },
    { resourceKey: "topping_group.status.feature", resourceName: "Topping Groups - Toggle Active Status", routePattern: "/pos/toppingGroup", resourceType: "feature", sortOrder: 24_96 },
    { resourceKey: "topping_group.delete.feature", resourceName: "Topping Groups - Delete Group", routePattern: "/pos/toppingGroup/manager/edit", resourceType: "feature", sortOrder: 24_97 },
    { resourceKey: "payments.page", resourceName: "Payments", routePattern: "/pos/payments", resourceType: "page", sortOrder: 25 },
    { resourceKey: "payments.checkout.feature", resourceName: "Payments - Create Checkout Payment", routePattern: "/pos/items", resourceType: "feature", sortOrder: 25_1 },
    { resourceKey: "delivery.page", resourceName: "Delivery", routePattern: "/pos/delivery", resourceType: "page", sortOrder: 26 },
    { resourceKey: "delivery.search.feature", resourceName: "Delivery - Search Providers", routePattern: "/pos/delivery", resourceType: "feature", sortOrder: 26_1 },
    { resourceKey: "delivery.filter.feature", resourceName: "Delivery - Filter and Sort", routePattern: "/pos/delivery", resourceType: "feature", sortOrder: 26_2 },
    { resourceKey: "delivery.manager.feature", resourceName: "Delivery - Open Manager Workspace", routePattern: "/pos/delivery/manager", resourceType: "feature", sortOrder: 26_3 },
    { resourceKey: "delivery.create.feature", resourceName: "Delivery - Create Provider", routePattern: "/pos/delivery/manager/add", resourceType: "feature", sortOrder: 26_4 },
    { resourceKey: "delivery.edit.feature", resourceName: "Delivery - Edit Provider Details", routePattern: "/pos/delivery/manager/edit", resourceType: "feature", sortOrder: 26_5 },
    { resourceKey: "delivery.status.feature", resourceName: "Delivery - Toggle Active Status", routePattern: "/pos/delivery", resourceType: "feature", sortOrder: 26_6 },
    { resourceKey: "delivery.delete.feature", resourceName: "Delivery - Delete Provider", routePattern: "/pos/delivery/manager/edit", resourceType: "feature", sortOrder: 26_7 },
    { resourceKey: "discounts.page", resourceName: "Discounts", routePattern: "/pos/discounts", resourceType: "page", sortOrder: 27 },
    { resourceKey: "discounts.search.feature", resourceName: "Discounts - Search Catalog", routePattern: "/pos/discounts", resourceType: "feature", sortOrder: 27_1 },
    { resourceKey: "discounts.filter.feature", resourceName: "Discounts - Filter and Sort", routePattern: "/pos/discounts", resourceType: "feature", sortOrder: 27_2 },
    { resourceKey: "discounts.manager.feature", resourceName: "Discounts - Open Manager Workspace", routePattern: "/pos/discounts/manager", resourceType: "feature", sortOrder: 27_3 },
    { resourceKey: "discounts.create.feature", resourceName: "Discounts - Create Discount", routePattern: "/pos/discounts/manager/add", resourceType: "feature", sortOrder: 27_4 },
    { resourceKey: "discounts.edit.feature", resourceName: "Discounts - Edit Catalog Details", routePattern: "/pos/discounts/manager/edit", resourceType: "feature", sortOrder: 27_5 },
    { resourceKey: "discounts.pricing.feature", resourceName: "Discounts - Edit Pricing Rules", routePattern: "/pos/discounts/manager/edit", resourceType: "feature", sortOrder: 27_6 },
    { resourceKey: "discounts.status.feature", resourceName: "Discounts - Toggle Active Status", routePattern: "/pos/discounts", resourceType: "feature", sortOrder: 27_7 },
    { resourceKey: "discounts.delete.feature", resourceName: "Discounts - Delete Discount", routePattern: "/pos/discounts/manager/edit", resourceType: "feature", sortOrder: 27_8 },
    { resourceKey: "payment_method.page", resourceName: "Payment Method", routePattern: "/pos/paymentMethod", resourceType: "page", sortOrder: 28 },
    { resourceKey: "payment_method.search.feature", resourceName: "Payment Method - Search Catalog", routePattern: "/pos/paymentMethod", resourceType: "feature", sortOrder: 28_1 },
    { resourceKey: "payment_method.filter.feature", resourceName: "Payment Method - Filter and Sort", routePattern: "/pos/paymentMethod", resourceType: "feature", sortOrder: 28_2 },
    { resourceKey: "payment_method.manager.feature", resourceName: "Payment Method - Open Manager Workspace", routePattern: "/pos/paymentMethod/manager", resourceType: "feature", sortOrder: 28_3 },
    { resourceKey: "payment_method.create.feature", resourceName: "Payment Method - Create Method", routePattern: "/pos/paymentMethod/manager/add", resourceType: "feature", sortOrder: 28_4 },
    { resourceKey: "payment_method.catalog.feature", resourceName: "Payment Method - Edit Catalog Details", routePattern: "/pos/paymentMethod/manager/edit", resourceType: "feature", sortOrder: 28_5 },
    { resourceKey: "payment_method.status.feature", resourceName: "Payment Method - Toggle Active Status", routePattern: "/pos/paymentMethod", resourceType: "feature", sortOrder: 28_6 },
    { resourceKey: "payment_method.delete.feature", resourceName: "Payment Method - Delete Method", routePattern: "/pos/paymentMethod/manager/edit", resourceType: "feature", sortOrder: 28_7 },
    { resourceKey: "tables.page", resourceName: "Tables", routePattern: "/pos/tables", resourceType: "page", sortOrder: 29 },
    { resourceKey: "tables.search.feature", resourceName: "Tables - Search Table Catalog", routePattern: "/pos/tables", resourceType: "feature", sortOrder: 29_1 },
    { resourceKey: "tables.filter.feature", resourceName: "Tables - Filter and Sort Table Catalog", routePattern: "/pos/tables", resourceType: "feature", sortOrder: 29_2 },
    { resourceKey: "tables.manager.feature", resourceName: "Tables - Open Manager Workspace", routePattern: "/pos/tables/manager", resourceType: "feature", sortOrder: 29_3 },
    { resourceKey: "tables.create.feature", resourceName: "Tables - Create Table", routePattern: "/pos/tables/manager/add", resourceType: "feature", sortOrder: 29_4 },
    { resourceKey: "tables.edit.feature", resourceName: "Tables - Edit Table Details", routePattern: "/pos/tables/manager/edit", resourceType: "feature", sortOrder: 29_5 },
    { resourceKey: "tables.status.feature", resourceName: "Tables - Toggle Table Active Status", routePattern: "/pos/tables", resourceType: "feature", sortOrder: 29_6 },
    { resourceKey: "tables.delete.feature", resourceName: "Tables - Delete Table", routePattern: "/pos/tables/manager/edit", resourceType: "feature", sortOrder: 29_7 },
    { resourceKey: "qr_code.page", resourceName: "QR Code", routePattern: "/pos/qr-code", resourceType: "page", sortOrder: 29_8 },
    { resourceKey: "qr_code.search.feature", resourceName: "QR Code - Search Table QR Catalog", routePattern: "/pos/qr-code", resourceType: "feature", sortOrder: 29_81 },
    { resourceKey: "qr_code.filter.feature", resourceName: "QR Code - Filter and Sort QR Catalog", routePattern: "/pos/qr-code", resourceType: "feature", sortOrder: 29_82 },
    { resourceKey: "qr_code.preview.feature", resourceName: "QR Code - Preview Table QR", routePattern: "/pos/qr-code", resourceType: "feature", sortOrder: 29_83 },
    { resourceKey: "qr_code.customer_link.feature", resourceName: "QR Code - Open Customer Ordering Link", routePattern: "/pos/qr-code", resourceType: "feature", sortOrder: 29_84 },
    { resourceKey: "qr_code.rotate.feature", resourceName: "QR Code - Rotate Table QR Token", routePattern: "/pos/qr-code", resourceType: "feature", sortOrder: 29_85 },
    { resourceKey: "qr_code.single_export.feature", resourceName: "QR Code - Export Single Table QR", routePattern: "/pos/qr-code", resourceType: "feature", sortOrder: 29_86 },
    { resourceKey: "qr_code.bulk_export.feature", resourceName: "QR Code - Bulk Export Table QR", routePattern: "/pos/qr-code", resourceType: "feature", sortOrder: 29_87 },
    { resourceKey: "qr_code.takeaway.feature", resourceName: "QR Code - Open Takeaway QR Workspace", routePattern: "/pos/qr-code", resourceType: "feature", sortOrder: 29_88 },
    { resourceKey: "qr_code.takeaway_rotate.feature", resourceName: "QR Code - Rotate Takeaway QR Token", routePattern: "/pos/qr-code", resourceType: "feature", sortOrder: 29_89 },
    { resourceKey: "qr_code.takeaway_customer_link.feature", resourceName: "QR Code - Open or Copy Takeaway Customer Link", routePattern: "/pos/qr-code", resourceType: "feature", sortOrder: 29_9 },
    { resourceKey: "qr_code.takeaway_export.feature", resourceName: "QR Code - Export Takeaway QR", routePattern: "/pos/qr-code", resourceType: "feature", sortOrder: 29_91 },
    { resourceKey: "pos_settings.page", resourceName: "POS Settings", routePattern: "/pos/settings", resourceType: "page", sortOrder: 30 },
    { resourceKey: "shop_profile.page", resourceName: "Shop Profile Data", routePattern: "/pos/settings", resourceType: "page", sortOrder: 30_1 },
    { resourceKey: "shop_profile.identity.feature", resourceName: "Shop Profile - Edit Identity", routePattern: "/pos/settings", resourceType: "feature", sortOrder: 30_2 },
    { resourceKey: "shop_profile.contact.feature", resourceName: "Shop Profile - Edit Contact", routePattern: "/pos/settings", resourceType: "feature", sortOrder: 30_3 },
    { resourceKey: "payment_accounts.page", resourceName: "Payment Accounts", routePattern: "/pos/settings/payment-accounts", resourceType: "page", sortOrder: 31 },
    { resourceKey: "payment_accounts.search.feature", resourceName: "Payment Accounts - Search Accounts", routePattern: "/pos/settings/payment-accounts/manage", resourceType: "feature", sortOrder: 31_1 },
    { resourceKey: "payment_accounts.filter.feature", resourceName: "Payment Accounts - Filter Accounts", routePattern: "/pos/settings/payment-accounts/manage", resourceType: "feature", sortOrder: 31_2 },
    { resourceKey: "payment_accounts.detail.feature", resourceName: "Payment Accounts - View Account Detail", routePattern: "/pos/settings/payment-accounts/edit", resourceType: "feature", sortOrder: 31_3 },
    { resourceKey: "payment_accounts.manager.feature", resourceName: "Payment Accounts - Open Manager Workspace", routePattern: "/pos/settings/payment-accounts/manage", resourceType: "feature", sortOrder: 31_4 },
    { resourceKey: "payment_accounts.create.feature", resourceName: "Payment Accounts - Create Account", routePattern: "/pos/settings/payment-accounts/add", resourceType: "feature", sortOrder: 31_5 },
    { resourceKey: "payment_accounts.edit.feature", resourceName: "Payment Accounts - Edit Account", routePattern: "/pos/settings/payment-accounts/edit", resourceType: "feature", sortOrder: 31_6 },
    { resourceKey: "payment_accounts.activate.feature", resourceName: "Payment Accounts - Set Active Account", routePattern: "/pos/settings/payment-accounts/manage", resourceType: "feature", sortOrder: 31_7 },
    { resourceKey: "payment_accounts.delete.feature", resourceName: "Payment Accounts - Delete Account", routePattern: "/pos/settings/payment-accounts/edit", resourceType: "feature", sortOrder: 31_8 },
    { resourceKey: "print_settings.page", resourceName: "Print Settings", routePattern: "/print-setting", resourceType: "page", sortOrder: 32 },
    { resourceKey: "print_settings.preview.feature", resourceName: "Print Settings - Live Preview", routePattern: "/print-setting", resourceType: "feature", sortOrder: 32_1 },
    { resourceKey: "print_settings.test_print.feature", resourceName: "Print Settings - Test Print", routePattern: "/print-setting", resourceType: "feature", sortOrder: 32_2 },
    { resourceKey: "print_settings.presets.feature", resourceName: "Print Settings - Presets", routePattern: "/print-setting", resourceType: "feature", sortOrder: 32_3 },
    { resourceKey: "print_settings.layout.feature", resourceName: "Print Settings - Layout Controls", routePattern: "/print-setting", resourceType: "feature", sortOrder: 32_4 },
    { resourceKey: "print_settings.visibility.feature", resourceName: "Print Settings - Visibility Controls", routePattern: "/print-setting", resourceType: "feature", sortOrder: 32_5 },
    { resourceKey: "print_settings.automation.feature", resourceName: "Print Settings - Automation", routePattern: "/print-setting", resourceType: "feature", sortOrder: 32_6 },
    { resourceKey: "print_settings.branch_defaults.feature", resourceName: "Print Settings - Branch Defaults", routePattern: "/print-setting", resourceType: "feature", sortOrder: 32_7 },
    { resourceKey: "print_settings.override_policy.feature", resourceName: "Print Settings - Manual Override Policy", routePattern: "/print-setting", resourceType: "feature", sortOrder: 32_8 },
    { resourceKey: "print_settings.reset.feature", resourceName: "Print Settings - Reset Controls", routePattern: "/print-setting", resourceType: "feature", sortOrder: 32_9 },
    { resourceKey: "print_settings.publish.feature", resourceName: "Print Settings - Publish Changes", routePattern: "/print-setting", resourceType: "feature", sortOrder: 32_91 },
    { resourceKey: "shifts.page", resourceName: "Shifts", routePattern: "/pos/shift", resourceType: "page", sortOrder: 33 },
    { resourceKey: "shifts.open.feature", resourceName: "Shifts - Open Current Shift", routePattern: "/pos/shift", resourceType: "feature", sortOrder: 33_1 },
    { resourceKey: "shifts.close_preview.feature", resourceName: "Shifts - Preview Close Shift", routePattern: "/pos/shift", resourceType: "feature", sortOrder: 33_2 },
    { resourceKey: "shifts.close.feature", resourceName: "Shifts - Close Current Shift", routePattern: "/pos/shift", resourceType: "feature", sortOrder: 33_3 },
    { resourceKey: "shifts.summary.feature", resourceName: "Shifts - View Shift KPI Summary", routePattern: "/pos/shift", resourceType: "feature", sortOrder: 33_4 },
    { resourceKey: "shifts.financials.feature", resourceName: "Shifts - View Cash Drawer and Payment Breakdown", routePattern: "/pos/shift", resourceType: "feature", sortOrder: 33_5 },
    { resourceKey: "shifts.channels.feature", resourceName: "Shifts - View Shift Channel Sales", routePattern: "/pos/shift", resourceType: "feature", sortOrder: 33_6 },
    { resourceKey: "shifts.top_products.feature", resourceName: "Shifts - View Top Products in Current Shift", routePattern: "/pos/shift", resourceType: "feature", sortOrder: 33_7 },
    { resourceKey: "shifts.history_nav.feature", resourceName: "Shifts - Navigate to Shift History", routePattern: "/pos/shift", resourceType: "feature", sortOrder: 33_8 },
    { resourceKey: "shift_history.page", resourceName: "Shift History", routePattern: "/pos/shiftHistory", resourceType: "page", sortOrder: 33_9 },
    { resourceKey: "shift_history.search.feature", resourceName: "Shift History - Search Shift Timeline", routePattern: "/pos/shiftHistory", resourceType: "feature", sortOrder: 33_91 },
    { resourceKey: "shift_history.filter.feature", resourceName: "Shift History - Filter and Sort Shift Timeline", routePattern: "/pos/shiftHistory", resourceType: "feature", sortOrder: 33_92 },
    { resourceKey: "shift_history.stats.feature", resourceName: "Shift History - View Branch Shift Stats", routePattern: "/pos/shiftHistory", resourceType: "feature", sortOrder: 33_93 },
    { resourceKey: "shift_history.summary.feature", resourceName: "Shift History - Open Shift Summary", routePattern: "/pos/shiftHistory", resourceType: "feature", sortOrder: 33_94 },
    { resourceKey: "shift_history.financials.feature", resourceName: "Shift History - View Shift Financial Amounts", routePattern: "/pos/shiftHistory", resourceType: "feature", sortOrder: 33_95 },
    { resourceKey: "reports.sales.page", resourceName: "Sales Report", routePattern: "/pos/dashboard", resourceType: "page", sortOrder: 34 },
    { resourceKey: "reports.sales.summary.feature", resourceName: "Sales Report - View KPI Summary and Daily Sales", routePattern: "/pos/dashboard", resourceType: "feature", sortOrder: 34_1 },
    { resourceKey: "reports.sales.filters.feature", resourceName: "Sales Report - Use Advanced Date Filters", routePattern: "/pos/dashboard", resourceType: "feature", sortOrder: 34_2 },
    { resourceKey: "reports.sales.channels.feature", resourceName: "Sales Report - View Sales Channels and Payment Mix", routePattern: "/pos/dashboard", resourceType: "feature", sortOrder: 34_3 },
    { resourceKey: "reports.sales.top_items.feature", resourceName: "Sales Report - View Top Selling Products", routePattern: "/pos/dashboard", resourceType: "feature", sortOrder: 34_4 },
    { resourceKey: "reports.sales.recent_orders.feature", resourceName: "Sales Report - View Recent Orders Feed", routePattern: "/pos/dashboard", resourceType: "feature", sortOrder: 34_5 },
    { resourceKey: "reports.sales.order_detail.feature", resourceName: "Sales Report - Open Order Detail from Dashboard", routePattern: "/pos/dashboard", resourceType: "feature", sortOrder: 34_6 },
    { resourceKey: "reports.sales.export.feature", resourceName: "Sales Report - Export or Print Dashboard Reports", routePattern: "/pos/dashboard", resourceType: "feature", sortOrder: 34_7 },
    { resourceKey: "reports.sales.receipt.feature", resourceName: "Sales Report - Print Receipt from Order Detail", routePattern: "/pos/dashboard", resourceType: "feature", sortOrder: 34_8 },
    { resourceKey: "stock.ingredients.page", resourceName: "Stock Ingredients", routePattern: "/stock/ingredients", resourceType: "page", sortOrder: 40 },
    { resourceKey: "stock.ingredients_unit.page", resourceName: "Stock Units", routePattern: "/stock/ingredientsUnit", resourceType: "page", sortOrder: 41 },
    { resourceKey: "stock.orders.page", resourceName: "Stock Orders", routePattern: "/stock/items", resourceType: "page", sortOrder: 42 },
    { resourceKey: "stock.category.page", resourceName: "Stock Categories", routePattern: "/stock/category", resourceType: "page", sortOrder: 43 },
];

const MANAGER_RESTRICTED_RESOURCES = new Set<string>([
    "permissions.page",
    "roles.page",
    "audit.page",
    "health_system.page",
    "menu.module.audit",
]);

const EMPLOYEE_READ_ALLOW = new Set<string>([
    "orders.page",
    "products.page",
    "products_unit.page",
    "topping.page",
    "topping_group.page",
    "shifts.page",
    "payments.page",
    "category.page",
    "delivery.page",
    "discounts.page",
    "payment_method.page",
    "qr_code.page",
    "reports.sales.page",
    "tables.page",
    "shop_profile.page",
    "stock.orders.page",
    "stock.ingredients.page",
    "stock.ingredients_unit.page",
    "stock.category.page",
    "menu.main.home",
    "menu.main.stock",
    "menu.main.orders",
    "menu.module.pos",
    "menu.module.stock",
]);

const EMPLOYEE_MENU_PREFIX_ALLOW = ["menu.pos.", "menu.stock."];
const EMPLOYEE_WRITE_ALLOW = new Set<string>(["stock.orders.page"]);
const ORDERS_SEARCH_FEATURE = "orders.search.feature";
const ORDERS_FILTER_FEATURE = "orders.filter.feature";
const ORDERS_SUMMARY_FEATURE = "orders.summary.feature";
const ORDERS_DETAIL_FEATURE = "orders.detail.feature";
const ORDERS_CHANNELS_FEATURE = "orders.channels.feature";
const ORDERS_CHANNEL_CREATE_FEATURE = "orders.channel_create.feature";
const ORDERS_SERVING_BOARD_FEATURE = "orders.serving_board.feature";
const ORDERS_SERVING_BOARD_UPDATE_FEATURE = "orders.serving_board_update.feature";
const ORDERS_LINE_ITEMS_FEATURE = "orders.line_items.feature";
const ORDERS_ITEM_STATUS_FEATURE = "orders.item_status.feature";
const ORDER_EDIT_FEATURE = "orders.edit.feature";
const ORDER_CANCEL_FEATURE = "orders.cancel.feature";
const PAYMENTS_CHECKOUT_FEATURE = "payments.checkout.feature";
const TABLES_SEARCH_FEATURE = "tables.search.feature";
const TABLES_FILTER_FEATURE = "tables.filter.feature";
const TABLES_MANAGER_FEATURE = "tables.manager.feature";
const TABLES_CREATE_FEATURE = "tables.create.feature";
const TABLES_EDIT_FEATURE = "tables.edit.feature";
const TABLES_STATUS_FEATURE = "tables.status.feature";
const TABLES_DELETE_FEATURE = "tables.delete.feature";
const PRODUCTS_SEARCH_FEATURE = "products.search.feature";
const PRODUCTS_FILTER_FEATURE = "products.filter.feature";
const PRODUCTS_MANAGER_FEATURE = "products.manager.feature";
const PRODUCTS_CREATE_FEATURE = "products.create.feature";
const PRODUCTS_CATALOG_FEATURE = "products.catalog.feature";
const PRODUCTS_PRICING_FEATURE = "products.pricing.feature";
const PRODUCTS_STRUCTURE_FEATURE = "products.structure.feature";
const PRODUCTS_STATUS_FEATURE = "products.status.feature";
const PRODUCTS_DELETE_FEATURE = "products.delete.feature";
const PRODUCTS_UNIT_SEARCH_FEATURE = "products_unit.search.feature";
const PRODUCTS_UNIT_FILTER_FEATURE = "products_unit.filter.feature";
const PRODUCTS_UNIT_MANAGER_FEATURE = "products_unit.manager.feature";
const PRODUCTS_UNIT_CREATE_FEATURE = "products_unit.create.feature";
const PRODUCTS_UNIT_EDIT_FEATURE = "products_unit.edit.feature";
const PRODUCTS_UNIT_STATUS_FEATURE = "products_unit.status.feature";
const PRODUCTS_UNIT_DELETE_FEATURE = "products_unit.delete.feature";
const CATEGORY_SEARCH_FEATURE = "category.search.feature";
const CATEGORY_FILTER_FEATURE = "category.filter.feature";
const CATEGORY_MANAGER_FEATURE = "category.manager.feature";
const CATEGORY_CREATE_FEATURE = "category.create.feature";
const CATEGORY_EDIT_FEATURE = "category.edit.feature";
const CATEGORY_STATUS_FEATURE = "category.status.feature";
const CATEGORY_DELETE_FEATURE = "category.delete.feature";
const TOPPING_SEARCH_FEATURE = "topping.search.feature";
const TOPPING_FILTER_FEATURE = "topping.filter.feature";
const TOPPING_MANAGER_FEATURE = "topping.manager.feature";
const TOPPING_CREATE_FEATURE = "topping.create.feature";
const TOPPING_CATALOG_FEATURE = "topping.catalog.feature";
const TOPPING_PRICING_FEATURE = "topping.pricing.feature";
const TOPPING_STATUS_FEATURE = "topping.status.feature";
const TOPPING_DELETE_FEATURE = "topping.delete.feature";
const TOPPING_GROUP_SEARCH_FEATURE = "topping_group.search.feature";
const TOPPING_GROUP_FILTER_FEATURE = "topping_group.filter.feature";
const TOPPING_GROUP_MANAGER_FEATURE = "topping_group.manager.feature";
const TOPPING_GROUP_CREATE_FEATURE = "topping_group.create.feature";
const TOPPING_GROUP_EDIT_FEATURE = "topping_group.edit.feature";
const TOPPING_GROUP_STATUS_FEATURE = "topping_group.status.feature";
const TOPPING_GROUP_DELETE_FEATURE = "topping_group.delete.feature";
const DELIVERY_SEARCH_FEATURE = "delivery.search.feature";
const DELIVERY_FILTER_FEATURE = "delivery.filter.feature";
const DELIVERY_MANAGER_FEATURE = "delivery.manager.feature";
const DELIVERY_CREATE_FEATURE = "delivery.create.feature";
const DELIVERY_EDIT_FEATURE = "delivery.edit.feature";
const DELIVERY_STATUS_FEATURE = "delivery.status.feature";
const DELIVERY_DELETE_FEATURE = "delivery.delete.feature";
const DISCOUNTS_SEARCH_FEATURE = "discounts.search.feature";
const DISCOUNTS_FILTER_FEATURE = "discounts.filter.feature";
const DISCOUNTS_MANAGER_FEATURE = "discounts.manager.feature";
const DISCOUNTS_CREATE_FEATURE = "discounts.create.feature";
const DISCOUNTS_EDIT_FEATURE = "discounts.edit.feature";
const DISCOUNTS_PRICING_FEATURE = "discounts.pricing.feature";
const DISCOUNTS_STATUS_FEATURE = "discounts.status.feature";
const DISCOUNTS_DELETE_FEATURE = "discounts.delete.feature";
const PAYMENT_METHOD_SEARCH_FEATURE = "payment_method.search.feature";
const PAYMENT_METHOD_FILTER_FEATURE = "payment_method.filter.feature";
const PAYMENT_METHOD_MANAGER_FEATURE = "payment_method.manager.feature";
const PAYMENT_METHOD_CREATE_FEATURE = "payment_method.create.feature";
const PAYMENT_METHOD_CATALOG_FEATURE = "payment_method.catalog.feature";
const PAYMENT_METHOD_STATUS_FEATURE = "payment_method.status.feature";
const PAYMENT_METHOD_DELETE_FEATURE = "payment_method.delete.feature";
const SHOP_PROFILE_IDENTITY_FEATURE = "shop_profile.identity.feature";
const SHOP_PROFILE_CONTACT_FEATURE = "shop_profile.contact.feature";
const PAYMENT_ACCOUNTS_SEARCH_FEATURE = "payment_accounts.search.feature";
const PAYMENT_ACCOUNTS_FILTER_FEATURE = "payment_accounts.filter.feature";
const PAYMENT_ACCOUNTS_DETAIL_FEATURE = "payment_accounts.detail.feature";
const PAYMENT_ACCOUNTS_MANAGER_FEATURE = "payment_accounts.manager.feature";
const PAYMENT_ACCOUNTS_CREATE_FEATURE = "payment_accounts.create.feature";
const PAYMENT_ACCOUNTS_EDIT_FEATURE = "payment_accounts.edit.feature";
const PAYMENT_ACCOUNTS_ACTIVATE_FEATURE = "payment_accounts.activate.feature";
const PAYMENT_ACCOUNTS_DELETE_FEATURE = "payment_accounts.delete.feature";
const QR_CODE_SEARCH_FEATURE = "qr_code.search.feature";
const QR_CODE_FILTER_FEATURE = "qr_code.filter.feature";
const QR_CODE_PREVIEW_FEATURE = "qr_code.preview.feature";
const QR_CODE_CUSTOMER_LINK_FEATURE = "qr_code.customer_link.feature";
const QR_CODE_ROTATE_FEATURE = "qr_code.rotate.feature";
const QR_CODE_SINGLE_EXPORT_FEATURE = "qr_code.single_export.feature";
const QR_CODE_BULK_EXPORT_FEATURE = "qr_code.bulk_export.feature";
const QR_CODE_TAKEAWAY_FEATURE = "qr_code.takeaway.feature";
const QR_CODE_TAKEAWAY_ROTATE_FEATURE = "qr_code.takeaway_rotate.feature";
const QR_CODE_TAKEAWAY_CUSTOMER_LINK_FEATURE = "qr_code.takeaway_customer_link.feature";
const QR_CODE_TAKEAWAY_EXPORT_FEATURE = "qr_code.takeaway_export.feature";
const SHIFTS_OPEN_FEATURE = "shifts.open.feature";
const SHIFTS_CLOSE_PREVIEW_FEATURE = "shifts.close_preview.feature";
const SHIFTS_CLOSE_FEATURE = "shifts.close.feature";
const SHIFTS_SUMMARY_FEATURE = "shifts.summary.feature";
const SHIFTS_FINANCIALS_FEATURE = "shifts.financials.feature";
const SHIFTS_CHANNELS_FEATURE = "shifts.channels.feature";
const SHIFTS_TOP_PRODUCTS_FEATURE = "shifts.top_products.feature";
const SHIFTS_HISTORY_NAV_FEATURE = "shifts.history_nav.feature";
const PRINT_SETTINGS_PREVIEW_FEATURE = "print_settings.preview.feature";
const PRINT_SETTINGS_TEST_PRINT_FEATURE = "print_settings.test_print.feature";
const PRINT_SETTINGS_PRESETS_FEATURE = "print_settings.presets.feature";
const PRINT_SETTINGS_LAYOUT_FEATURE = "print_settings.layout.feature";
const PRINT_SETTINGS_VISIBILITY_FEATURE = "print_settings.visibility.feature";
const PRINT_SETTINGS_AUTOMATION_FEATURE = "print_settings.automation.feature";
const PRINT_SETTINGS_BRANCH_DEFAULTS_FEATURE = "print_settings.branch_defaults.feature";
const PRINT_SETTINGS_OVERRIDE_POLICY_FEATURE = "print_settings.override_policy.feature";
const PRINT_SETTINGS_RESET_FEATURE = "print_settings.reset.feature";
const PRINT_SETTINGS_PUBLISH_FEATURE = "print_settings.publish.feature";
const SHIFT_HISTORY_PAGE = "shift_history.page";
const SHIFT_HISTORY_SEARCH_FEATURE = "shift_history.search.feature";
const SHIFT_HISTORY_FILTER_FEATURE = "shift_history.filter.feature";
const SHIFT_HISTORY_STATS_FEATURE = "shift_history.stats.feature";
const SHIFT_HISTORY_SUMMARY_FEATURE = "shift_history.summary.feature";
const SHIFT_HISTORY_FINANCIALS_FEATURE = "shift_history.financials.feature";
const DASHBOARD_SUMMARY_FEATURE = "reports.sales.summary.feature";
const DASHBOARD_FILTERS_FEATURE = "reports.sales.filters.feature";
const DASHBOARD_CHANNELS_FEATURE = "reports.sales.channels.feature";
const DASHBOARD_TOP_ITEMS_FEATURE = "reports.sales.top_items.feature";
const DASHBOARD_RECENT_ORDERS_FEATURE = "reports.sales.recent_orders.feature";
const DASHBOARD_ORDER_DETAIL_FEATURE = "reports.sales.order_detail.feature";
const DASHBOARD_EXPORT_FEATURE = "reports.sales.export.feature";
const DASHBOARD_RECEIPT_FEATURE = "reports.sales.receipt.feature";

function isProductsFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("products.") && resourceKey.endsWith(".feature");
}

function isOrdersFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("orders.") && resourceKey.endsWith(".feature");
}

function isPaymentsFeature(resourceKey: string): boolean {
    return resourceKey === PAYMENTS_CHECKOUT_FEATURE;
}

function isManagerOrdersActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (
        resourceKey === ORDERS_SEARCH_FEATURE ||
        resourceKey === ORDERS_FILTER_FEATURE ||
        resourceKey === ORDERS_SUMMARY_FEATURE ||
        resourceKey === ORDERS_DETAIL_FEATURE ||
        resourceKey === ORDERS_CHANNELS_FEATURE ||
        resourceKey === ORDERS_SERVING_BOARD_FEATURE
    ) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === ORDERS_CHANNEL_CREATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (
        resourceKey === ORDERS_SERVING_BOARD_UPDATE_FEATURE ||
        resourceKey === ORDERS_LINE_ITEMS_FEATURE ||
        resourceKey === ORDERS_ITEM_STATUS_FEATURE ||
        resourceKey === ORDER_EDIT_FEATURE
    ) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (resourceKey === ORDER_CANCEL_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    return false;
}

function isManagerPaymentsActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === PAYMENTS_CHECKOUT_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    return false;
}

function isTablesFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("tables.") && resourceKey.endsWith(".feature");
}

function isManagerTablesActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === TABLES_SEARCH_FEATURE || resourceKey === TABLES_FILTER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === TABLES_MANAGER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === TABLES_CREATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (resourceKey === TABLES_EDIT_FEATURE || resourceKey === TABLES_STATUS_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (resourceKey === TABLES_DELETE_FEATURE) {
        return false;
    }

    return false;
}

function isManagerProductsActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === PRODUCTS_SEARCH_FEATURE || resourceKey === PRODUCTS_FILTER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === PRODUCTS_MANAGER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === PRODUCTS_CREATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (
        resourceKey === PRODUCTS_CATALOG_FEATURE ||
        resourceKey === PRODUCTS_PRICING_FEATURE ||
        resourceKey === PRODUCTS_STRUCTURE_FEATURE ||
        resourceKey === PRODUCTS_STATUS_FEATURE
    ) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (resourceKey === PRODUCTS_DELETE_FEATURE) {
        return false;
    }

    return false;
}

function isProductsUnitFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("products_unit.") && resourceKey.endsWith(".feature");
}

function isManagerProductsUnitActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === PRODUCTS_UNIT_SEARCH_FEATURE || resourceKey === PRODUCTS_UNIT_FILTER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === PRODUCTS_UNIT_MANAGER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === PRODUCTS_UNIT_CREATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (resourceKey === PRODUCTS_UNIT_EDIT_FEATURE || resourceKey === PRODUCTS_UNIT_STATUS_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (resourceKey === PRODUCTS_UNIT_DELETE_FEATURE) {
        return false;
    }

    return false;
}

function isCategoryFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("category.") && resourceKey.endsWith(".feature");
}

function isManagerCategoryActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === CATEGORY_SEARCH_FEATURE || resourceKey === CATEGORY_FILTER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === CATEGORY_MANAGER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === CATEGORY_CREATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (resourceKey === CATEGORY_EDIT_FEATURE || resourceKey === CATEGORY_STATUS_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (resourceKey === CATEGORY_DELETE_FEATURE) {
        return false;
    }

    return false;
}

function isToppingFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("topping.") && resourceKey.endsWith(".feature");
}

function isToppingGroupFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("topping_group.") && resourceKey.endsWith(".feature");
}

function isManagerToppingActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === TOPPING_SEARCH_FEATURE || resourceKey === TOPPING_FILTER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === TOPPING_MANAGER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === TOPPING_CREATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (
        resourceKey === TOPPING_CATALOG_FEATURE ||
        resourceKey === TOPPING_PRICING_FEATURE ||
        resourceKey === TOPPING_STATUS_FEATURE
    ) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (resourceKey === TOPPING_DELETE_FEATURE) {
        return false;
    }

    return false;
}

function isManagerToppingGroupActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === TOPPING_GROUP_SEARCH_FEATURE || resourceKey === TOPPING_GROUP_FILTER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === TOPPING_GROUP_MANAGER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === TOPPING_GROUP_CREATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (resourceKey === TOPPING_GROUP_EDIT_FEATURE || resourceKey === TOPPING_GROUP_STATUS_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (resourceKey === TOPPING_GROUP_DELETE_FEATURE) {
        return false;
    }

    return false;
}

function isDeliveryFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("delivery.") && resourceKey.endsWith(".feature");
}

function isManagerDeliveryActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === DELIVERY_SEARCH_FEATURE || resourceKey === DELIVERY_FILTER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === DELIVERY_MANAGER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === DELIVERY_CREATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (resourceKey === DELIVERY_EDIT_FEATURE || resourceKey === DELIVERY_STATUS_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (resourceKey === DELIVERY_DELETE_FEATURE) {
        return false;
    }

    return false;
}

function isDiscountsFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("discounts.") && resourceKey.endsWith(".feature");
}

function isManagerDiscountsActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === DISCOUNTS_SEARCH_FEATURE || resourceKey === DISCOUNTS_FILTER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === DISCOUNTS_MANAGER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === DISCOUNTS_CREATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (
        resourceKey === DISCOUNTS_EDIT_FEATURE ||
        resourceKey === DISCOUNTS_PRICING_FEATURE ||
        resourceKey === DISCOUNTS_STATUS_FEATURE
    ) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (resourceKey === DISCOUNTS_DELETE_FEATURE) {
        return false;
    }

    return false;
}

function isPaymentMethodFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("payment_method.") && resourceKey.endsWith(".feature");
}

function isShopProfileFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("shop_profile.") && resourceKey.endsWith(".feature");
}

function isPaymentAccountsFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("payment_accounts.") && resourceKey.endsWith(".feature");
}

function isManagerShopProfileActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === SHOP_PROFILE_IDENTITY_FEATURE || resourceKey === SHOP_PROFILE_CONTACT_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    return false;
}

function isManagerPaymentAccountsActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === PAYMENT_ACCOUNTS_SEARCH_FEATURE || resourceKey === PAYMENT_ACCOUNTS_FILTER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === PAYMENT_ACCOUNTS_DETAIL_FEATURE || resourceKey === PAYMENT_ACCOUNTS_MANAGER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === PAYMENT_ACCOUNTS_CREATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (resourceKey === PAYMENT_ACCOUNTS_EDIT_FEATURE || resourceKey === PAYMENT_ACCOUNTS_ACTIVATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (resourceKey === PAYMENT_ACCOUNTS_DELETE_FEATURE) {
        return false;
    }

    return false;
}

function isManagerPaymentMethodActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === PAYMENT_METHOD_SEARCH_FEATURE || resourceKey === PAYMENT_METHOD_FILTER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === PAYMENT_METHOD_MANAGER_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === PAYMENT_METHOD_CREATE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (resourceKey === PAYMENT_METHOD_CATALOG_FEATURE || resourceKey === PAYMENT_METHOD_STATUS_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (resourceKey === PAYMENT_METHOD_DELETE_FEATURE) {
        return false;
    }

    return false;
}

function isPrintSettingsFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("print_settings.") && resourceKey.endsWith(".feature");
}

function isShiftFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("shifts.") && resourceKey.endsWith(".feature");
}

function isShiftHistoryFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("shift_history.") && resourceKey.endsWith(".feature");
}

function isQrCodeFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("qr_code.") && resourceKey.endsWith(".feature");
}

function isDashboardFeature(resourceKey: string): boolean {
    return resourceKey.startsWith("reports.sales.") && resourceKey.endsWith(".feature");
}

function isManagerQrCodeActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (
        resourceKey === QR_CODE_SEARCH_FEATURE ||
        resourceKey === QR_CODE_FILTER_FEATURE ||
        resourceKey === QR_CODE_PREVIEW_FEATURE ||
        resourceKey === QR_CODE_CUSTOMER_LINK_FEATURE ||
        resourceKey === QR_CODE_TAKEAWAY_FEATURE ||
        resourceKey === QR_CODE_TAKEAWAY_CUSTOMER_LINK_FEATURE
    ) {
        return actionKey === "access" || actionKey === "view";
    }

    if (
        resourceKey === QR_CODE_ROTATE_FEATURE ||
        resourceKey === QR_CODE_SINGLE_EXPORT_FEATURE ||
        resourceKey === QR_CODE_BULK_EXPORT_FEATURE ||
        resourceKey === QR_CODE_TAKEAWAY_ROTATE_FEATURE ||
        resourceKey === QR_CODE_TAKEAWAY_EXPORT_FEATURE
    ) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    return false;
}

function isManagerPrintSettingsActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (resourceKey === PRINT_SETTINGS_PREVIEW_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === PRINT_SETTINGS_TEST_PRINT_FEATURE) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === PRINT_SETTINGS_OVERRIDE_POLICY_FEATURE) {
        return false;
    }

    if (resourceKey === PRINT_SETTINGS_PUBLISH_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    if (
        resourceKey === PRINT_SETTINGS_PRESETS_FEATURE ||
        resourceKey === PRINT_SETTINGS_LAYOUT_FEATURE ||
        resourceKey === PRINT_SETTINGS_VISIBILITY_FEATURE ||
        resourceKey === PRINT_SETTINGS_AUTOMATION_FEATURE ||
        resourceKey === PRINT_SETTINGS_BRANCH_DEFAULTS_FEATURE ||
        resourceKey === PRINT_SETTINGS_RESET_FEATURE
    ) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    return false;
}

function isManagerShiftActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (
        resourceKey === SHIFTS_SUMMARY_FEATURE ||
        resourceKey === SHIFTS_FINANCIALS_FEATURE ||
        resourceKey === SHIFTS_CHANNELS_FEATURE ||
        resourceKey === SHIFTS_TOP_PRODUCTS_FEATURE ||
        resourceKey === SHIFTS_HISTORY_NAV_FEATURE ||
        resourceKey === SHIFTS_CLOSE_PREVIEW_FEATURE
    ) {
        return actionKey === "access" || actionKey === "view";
    }

    if (resourceKey === SHIFTS_OPEN_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "create";
    }

    if (resourceKey === SHIFTS_CLOSE_FEATURE) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    return false;
}

function isManagerShiftHistoryActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (
        resourceKey === SHIFT_HISTORY_SEARCH_FEATURE ||
        resourceKey === SHIFT_HISTORY_FILTER_FEATURE ||
        resourceKey === SHIFT_HISTORY_STATS_FEATURE ||
        resourceKey === SHIFT_HISTORY_SUMMARY_FEATURE ||
        resourceKey === SHIFT_HISTORY_FINANCIALS_FEATURE
    ) {
        return actionKey === "access" || actionKey === "view";
    }

    return false;
}

function isManagerDashboardActionAllowed(resourceKey: string, actionKey: ActionKey): boolean {
    if (
        resourceKey === DASHBOARD_SUMMARY_FEATURE ||
        resourceKey === DASHBOARD_FILTERS_FEATURE ||
        resourceKey === DASHBOARD_CHANNELS_FEATURE ||
        resourceKey === DASHBOARD_TOP_ITEMS_FEATURE ||
        resourceKey === DASHBOARD_RECENT_ORDERS_FEATURE ||
        resourceKey === DASHBOARD_ORDER_DETAIL_FEATURE ||
        resourceKey === DASHBOARD_EXPORT_FEATURE ||
        resourceKey === DASHBOARD_RECEIPT_FEATURE
    ) {
        return actionKey === "access" || actionKey === "view" || actionKey === "update";
    }

    return false;
}

function normalizeRoleName(roleName: string): RoleName | null {
    const value = roleName.trim().toLowerCase();
    if (value === "admin") return "Admin";
    if (value === "manager" || value === "maneger") return "Manager";
    if (value === "employee") return "Employee";
    return null;
}

function toPermissionPolicy(
    roleName: RoleName,
    resource: PermissionResourceRow,
    actionKey: ActionKey
): PermissionPolicy {
    if (roleName === "Admin") {
        return { effect: "allow", scope: "all" };
    }

    const resourceKey = resource.resource_key;
    const isMenu = resource.resource_type === "menu";

    if (roleName === "Manager") {
        if (resourceKey === "orders.page" || resourceKey === "payments.page") {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
            return { effect: "deny", scope: "none" };
        }

        if (isOrdersFeature(resourceKey)) {
            return isManagerOrdersActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isPaymentsFeature(resourceKey)) {
            return isManagerPaymentsActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (resourceKey === "pos_settings.page") {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
            return { effect: "deny", scope: "none" };
        }

        if (resourceKey === "shop_profile.page") {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
            return { effect: "deny", scope: "none" };
        }

        if (isShopProfileFeature(resourceKey)) {
            return isManagerShopProfileActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (resourceKey === "payment_accounts.page") {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
            return { effect: "deny", scope: "none" };
        }

        if (isPaymentAccountsFeature(resourceKey)) {
            return isManagerPaymentAccountsActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (resourceKey === "shifts.page") {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
            return { effect: "deny", scope: "none" };
        }

        if (isShiftFeature(resourceKey)) {
            return isManagerShiftActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (resourceKey === SHIFT_HISTORY_PAGE) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
            return { effect: "deny", scope: "none" };
        }

        if (isTablesFeature(resourceKey)) {
            return isManagerTablesActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isProductsFeature(resourceKey)) {
            return isManagerProductsActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isProductsUnitFeature(resourceKey)) {
            return isManagerProductsUnitActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isCategoryFeature(resourceKey)) {
            return isManagerCategoryActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isToppingFeature(resourceKey)) {
            return isManagerToppingActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isToppingGroupFeature(resourceKey)) {
            return isManagerToppingGroupActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isDeliveryFeature(resourceKey)) {
            return isManagerDeliveryActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isDiscountsFeature(resourceKey)) {
            return isManagerDiscountsActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isPaymentMethodFeature(resourceKey)) {
            return isManagerPaymentMethodActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isPrintSettingsFeature(resourceKey)) {
            return isManagerPrintSettingsActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isShiftHistoryFeature(resourceKey)) {
            return isManagerShiftHistoryActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isQrCodeFeature(resourceKey)) {
            return isManagerQrCodeActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (isDashboardFeature(resourceKey)) {
            return isManagerDashboardActionAllowed(resourceKey, actionKey)
                ? { effect: "allow", scope: "branch" }
                : { effect: "deny", scope: "none" };
        }

        if (MANAGER_RESTRICTED_RESOURCES.has(resourceKey)) {
            return { effect: "deny", scope: "none" };
        }

        if (actionKey === "access" || actionKey === "view") {
            return { effect: "allow", scope: "branch" };
        }

        if (isMenu) {
            return { effect: "deny", scope: "none" };
        }

        if (resourceKey === "branches.page") {
            return { effect: "deny", scope: "none" };
        }

        if (actionKey === "delete") {
            return { effect: "deny", scope: "none" };
        }

        return { effect: "allow", scope: "branch" };
    }

    if (actionKey === "delete") {
        return { effect: "deny", scope: "none" };
    }

    if (resourceKey === "orders.page" || resourceKey === "payments.page") {
        if (actionKey === "access" || actionKey === "view") {
            return { effect: "allow", scope: "branch" };
        }
        return { effect: "deny", scope: "none" };
    }

    if (resourceKey === "shifts.page") {
        if (actionKey === "access" || actionKey === "view") {
            return { effect: "allow", scope: "branch" };
        }
        return { effect: "deny", scope: "none" };
    }

    if (isOrdersFeature(resourceKey)) {
        if (
            resourceKey === ORDERS_SEARCH_FEATURE ||
            resourceKey === ORDERS_FILTER_FEATURE ||
            resourceKey === ORDERS_SUMMARY_FEATURE ||
            resourceKey === ORDERS_DETAIL_FEATURE ||
            resourceKey === ORDERS_CHANNELS_FEATURE ||
            resourceKey === ORDERS_SERVING_BOARD_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        if (resourceKey === ORDERS_CHANNEL_CREATE_FEATURE) {
            if (actionKey === "access" || actionKey === "view" || actionKey === "create") {
                return { effect: "allow", scope: "branch" };
            }
        }

        if (
            resourceKey === ORDERS_SERVING_BOARD_UPDATE_FEATURE ||
            resourceKey === ORDERS_LINE_ITEMS_FEATURE ||
            resourceKey === ORDERS_ITEM_STATUS_FEATURE ||
            resourceKey === ORDER_EDIT_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view" || actionKey === "update") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isPaymentsFeature(resourceKey)) {
        if (actionKey === "access" || actionKey === "view" || actionKey === "create") {
            return { effect: "allow", scope: "branch" };
        }
        return { effect: "deny", scope: "none" };
    }

    if (resourceKey === "pos_settings.page") {
        return { effect: "deny", scope: "none" };
    }

    if (resourceKey === "shop_profile.page") {
        if (actionKey === "access" || actionKey === "view") {
            return { effect: "allow", scope: "branch" };
        }
        return { effect: "deny", scope: "none" };
    }

    if (isShopProfileFeature(resourceKey) || resourceKey === "payment_accounts.page" || isPaymentAccountsFeature(resourceKey)) {
        return { effect: "deny", scope: "none" };
    }

    if (resourceKey === SHIFT_HISTORY_PAGE) {
        if (actionKey === "access" || actionKey === "view") {
            return { effect: "allow", scope: "own" };
        }
        return { effect: "deny", scope: "none" };
    }

    if (isPrintSettingsFeature(resourceKey)) {
        return { effect: "deny", scope: "none" };
    }

    if (isShiftFeature(resourceKey)) {
        if (resourceKey === SHIFTS_OPEN_FEATURE) {
            if (actionKey === "access" || actionKey === "view" || actionKey === "create") {
                return { effect: "allow", scope: "branch" };
            }
        }

        if (resourceKey === SHIFTS_CLOSE_PREVIEW_FEATURE) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "own" };
            }
        }

        if (resourceKey === SHIFTS_CLOSE_FEATURE) {
            if (actionKey === "access" || actionKey === "view" || actionKey === "update") {
                return { effect: "allow", scope: "own" };
            }
        }

        if (
            resourceKey === SHIFTS_SUMMARY_FEATURE ||
            resourceKey === SHIFTS_CHANNELS_FEATURE ||
            resourceKey === SHIFTS_TOP_PRODUCTS_FEATURE ||
            resourceKey === SHIFTS_HISTORY_NAV_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        if (resourceKey === SHIFTS_FINANCIALS_FEATURE) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "own" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isShiftHistoryFeature(resourceKey)) {
        if (
            resourceKey === SHIFT_HISTORY_SEARCH_FEATURE ||
            resourceKey === SHIFT_HISTORY_FILTER_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "own" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isTablesFeature(resourceKey)) {
        if (
            resourceKey === TABLES_SEARCH_FEATURE ||
            resourceKey === TABLES_FILTER_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isQrCodeFeature(resourceKey)) {
        if (
            resourceKey === QR_CODE_SEARCH_FEATURE ||
            resourceKey === QR_CODE_FILTER_FEATURE ||
            resourceKey === QR_CODE_PREVIEW_FEATURE ||
            resourceKey === QR_CODE_CUSTOMER_LINK_FEATURE ||
            resourceKey === QR_CODE_TAKEAWAY_FEATURE ||
            resourceKey === QR_CODE_TAKEAWAY_CUSTOMER_LINK_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        if (
            resourceKey === QR_CODE_SINGLE_EXPORT_FEATURE ||
            resourceKey === QR_CODE_TAKEAWAY_EXPORT_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view" || actionKey === "update") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isDashboardFeature(resourceKey)) {
        if (
            resourceKey === DASHBOARD_SUMMARY_FEATURE ||
            resourceKey === DASHBOARD_TOP_ITEMS_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isProductsFeature(resourceKey)) {
        if (
            resourceKey === PRODUCTS_SEARCH_FEATURE ||
            resourceKey === PRODUCTS_FILTER_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isProductsUnitFeature(resourceKey)) {
        if (
            resourceKey === PRODUCTS_UNIT_SEARCH_FEATURE ||
            resourceKey === PRODUCTS_UNIT_FILTER_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isDeliveryFeature(resourceKey)) {
        if (
            resourceKey === DELIVERY_SEARCH_FEATURE ||
            resourceKey === DELIVERY_FILTER_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isDiscountsFeature(resourceKey)) {
        if (
            resourceKey === DISCOUNTS_SEARCH_FEATURE ||
            resourceKey === DISCOUNTS_FILTER_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isPaymentMethodFeature(resourceKey)) {
        if (
            resourceKey === PAYMENT_METHOD_SEARCH_FEATURE ||
            resourceKey === PAYMENT_METHOD_FILTER_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isCategoryFeature(resourceKey)) {
        if (
            resourceKey === CATEGORY_SEARCH_FEATURE ||
            resourceKey === CATEGORY_FILTER_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isToppingFeature(resourceKey)) {
        if (
            resourceKey === TOPPING_SEARCH_FEATURE ||
            resourceKey === TOPPING_FILTER_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (isToppingGroupFeature(resourceKey)) {
        if (
            resourceKey === TOPPING_GROUP_SEARCH_FEATURE ||
            resourceKey === TOPPING_GROUP_FILTER_FEATURE
        ) {
            if (actionKey === "access" || actionKey === "view") {
                return { effect: "allow", scope: "branch" };
            }
        }

        return { effect: "deny", scope: "none" };
    }

    if (actionKey === "access" || actionKey === "view") {
        if (EMPLOYEE_READ_ALLOW.has(resourceKey)) {
            return { effect: "allow", scope: "branch" };
        }

        if (isMenu && EMPLOYEE_MENU_PREFIX_ALLOW.some((prefix) => resourceKey.startsWith(prefix))) {
            return { effect: "allow", scope: "branch" };
        }

        return { effect: "deny", scope: "none" };
    }

    if (EMPLOYEE_WRITE_ALLOW.has(resourceKey) && (actionKey === "create" || actionKey === "update")) {
        return { effect: "allow", scope: "branch" };
    }

    return { effect: "deny", scope: "none" };
}

async function tableExists(queryRunner: QueryRunner, tableName: string): Promise<boolean> {
    const rows = await queryRunner.query(`SELECT to_regclass($1) AS regclass`, [tableName]);
    return Boolean(rows?.[0]?.regclass);
}

async function ensureDefaultBranch(queryRunner: QueryRunner): Promise<string | null> {
    if (!(await tableExists(queryRunner, "public.branches"))) {
        return null;
    }

    const existing = await queryRunner.query(
        `SELECT id FROM branches WHERE is_active = true ORDER BY create_date ASC LIMIT 1`
    );
    if (existing?.[0]?.id) {
        return existing[0].id as string;
    }

    const branchName = process.env.BOOTSTRAP_DEFAULT_BRANCH_NAME || "Main Branch";
    const branchCode = process.env.BOOTSTRAP_DEFAULT_BRANCH_CODE || "MB";

    const inserted = await queryRunner.query(
        `
            INSERT INTO branches (branch_name, branch_code, is_active)
            VALUES ($1, $2, true)
            ON CONFLICT (branch_code)
            DO UPDATE SET branch_name = EXCLUDED.branch_name, is_active = true
            RETURNING id
        `,
        [branchName, branchCode]
    );

    return (inserted?.[0]?.id as string) || null;
}

async function ensureCoreRoles(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, "public.roles"))) {
        return;
    }

    for (const role of CORE_ROLES) {
        await queryRunner.query(
            `
                INSERT INTO roles (roles_name, display_name)
                VALUES ($1, $2)
                ON CONFLICT (roles_name)
                DO UPDATE SET display_name = EXCLUDED.display_name
            `,
            [role.roleName, role.displayName]
        );
    }
}

async function ensurePermissionActions(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, "public.permission_actions"))) {
        return;
    }

    for (const actionKey of ACTION_KEYS) {
        await queryRunner.query(
            `
                INSERT INTO permission_actions (action_key, action_name, is_active)
                VALUES ($1, $2, true)
                ON CONFLICT (action_key)
                DO UPDATE SET action_name = EXCLUDED.action_name, is_active = true
            `,
            [actionKey, actionKey]
        );
    }
}

async function ensurePermissionResources(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, "public.permission_resources"))) {
        return;
    }

    for (const resource of CORE_PERMISSION_RESOURCES) {
        await queryRunner.query(
            `
                INSERT INTO permission_resources
                    (resource_key, resource_name, route_pattern, resource_type, sort_order, is_active)
                VALUES
                    ($1, $2, $3, $4, $5, true)
                ON CONFLICT (resource_key)
                DO UPDATE SET
                    resource_name = EXCLUDED.resource_name,
                    route_pattern = EXCLUDED.route_pattern,
                    resource_type = EXCLUDED.resource_type,
                    sort_order = EXCLUDED.sort_order,
                    is_active = true,
                    updated_at = now()
            `,
            [
                resource.resourceKey,
                resource.resourceName,
                resource.routePattern,
                resource.resourceType,
                resource.sortOrder,
            ]
        );
    }
}

async function ensureRolePermissionDefaults(queryRunner: QueryRunner): Promise<void> {
    const hasRoles = await tableExists(queryRunner, "public.roles");
    const hasResources = await tableExists(queryRunner, "public.permission_resources");
    const hasActions = await tableExists(queryRunner, "public.permission_actions");
    const hasRolePermissions = await tableExists(queryRunner, "public.role_permissions");
    if (!hasRoles || !hasResources || !hasActions || !hasRolePermissions) {
        return;
    }

    const roleRows = (await queryRunner.query(
        `
            SELECT id, roles_name
            FROM roles
            WHERE lower(roles_name) IN ('admin', 'manager', 'maneger', 'employee')
        `
    )) as Array<{ id: string; roles_name: string }>;
    const roles: RoleRow[] = roleRows
        .map((row) => {
            const normalized = normalizeRoleName(row.roles_name);
            if (!normalized) return null;
            return { id: row.id, roles_name: normalized };
        })
        .filter((row): row is RoleRow => !!row);

    if (roles.length === 0) {
        return;
    }

    const resources = (await queryRunner.query(
        `SELECT id, resource_key, resource_type FROM permission_resources WHERE is_active = true`
    )) as PermissionResourceRow[];
    const actions = (await queryRunner.query(
        `SELECT id, action_key FROM permission_actions WHERE is_active = true`
    )) as PermissionActionRow[];

    for (const role of roles) {
        for (const resource of resources) {
            for (const action of actions) {
                const policy = toPermissionPolicy(role.roles_name, resource, action.action_key);
                await queryRunner.query(
                    `
                        INSERT INTO role_permissions (role_id, resource_id, action_id, effect, scope)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (role_id, resource_id, action_id)
                        DO UPDATE SET
                            effect = EXCLUDED.effect,
                            scope = EXCLUDED.scope
                        WHERE role_permissions.effect = 'deny'
                          AND role_permissions.scope = 'none'
                          AND EXCLUDED.effect = 'allow'
                    `,
                    [role.id, resource.id, action.id, policy.effect, policy.scope]
                );
            }
        }
    }
}

async function ensureDefaultAdminUser(queryRunner: QueryRunner, fallbackBranchId: string | null): Promise<void> {
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
    if (!username || !password) {
        return;
    }

    const hasUsers = await tableExists(queryRunner, "public.users");
    const hasRoles = await tableExists(queryRunner, "public.roles");
    if (!hasUsers || !hasRoles) {
        return;
    }

    const roleRows = await queryRunner.query(
        `SELECT id FROM roles WHERE lower(roles_name) = 'admin' LIMIT 1`
    );
    const adminRoleId = roleRows?.[0]?.id as string | undefined;
    if (!adminRoleId) {
        return;
    }

    let branchId = process.env.BOOTSTRAP_ADMIN_BRANCH_ID?.trim() || fallbackBranchId || null;
    if (!branchId && (await tableExists(queryRunner, "public.branches"))) {
        const rows = await queryRunner.query(
            `SELECT id FROM branches WHERE is_active = true ORDER BY create_date ASC LIMIT 1`
        );
        branchId = (rows?.[0]?.id as string | undefined) || null;
    }

    if (!branchId) {
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "System Administrator";

    const existingRows = await queryRunner.query(
        `SELECT id FROM users WHERE username = $1 LIMIT 1`,
        [username]
    );

    if (existingRows?.[0]?.id) {
        await queryRunner.query(
            `
                UPDATE users
                SET name = $1,
                    password = $2,
                    roles_id = $3,
                    branch_id = $4,
                    is_use = true
                WHERE id = $5
            `,
            [displayName, passwordHash, adminRoleId, branchId, existingRows[0].id]
        );
        return;
    }

    await queryRunner.query(
        `
            INSERT INTO users (username, name, password, roles_id, branch_id, is_use, is_active)
            VALUES ($1, $2, $3, $4, $5, true, false)
        `,
        [username, displayName, passwordHash, adminRoleId, branchId]
    );
}

export async function ensureRbacDefaults(dataSource: DataSource): Promise<void> {
    const enabled = process.env.RUN_RBAC_BASELINE_ON_START !== "false";
    if (!enabled) {
        return;
    }

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
        // Bootstrap must run with admin RLS context to seed branch/user rows when policies are enabled.
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', false)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', false)`);
        await queryRunner.query(`SELECT set_config('app.user_id', '', false)`);

        await ensureCoreRoles(queryRunner);
        await ensurePermissionActions(queryRunner);
        await ensurePermissionResources(queryRunner);
        const defaultBranchId = await ensureDefaultBranch(queryRunner);
        await ensureRolePermissionDefaults(queryRunner);
        await ensureDefaultAdminUser(queryRunner, defaultBranchId);
        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
        await queryRunner.release();
    }
}
