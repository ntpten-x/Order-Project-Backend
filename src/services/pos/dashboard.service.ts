import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { Products } from "../../entity/pos/Products";
import { Payments } from "../../entity/pos/Payments";
import { PaymentMethod } from "../../entity/pos/PaymentMethod";
import { SalesSummaryView } from "../../entity/pos/views/SalesSummaryView";
import { TopSellingItemsView } from "../../entity/pos/views/TopSellingItemsView";
import { getDbContext, getRepository } from "../../database/dbContext";
import { cacheKey, queryCache, withCache } from "../../utils/cache";
import { AppError } from "../../utils/AppError";
import { metrics } from "../../utils/metrics";
import { logProfileDuration } from "../../utils/queryProfiler";
import { getReadModelVersionToken } from "./readModelVersion.utils";
import { SelectQueryBuilder } from "typeorm";

type DashboardRecentOrderSummary = {
    id: string;
    order_no: string;
    order_type: string;
    status: string;
    create_date: string;
    update_date?: string;
    total_amount: number;
    delivery_code?: string | null;
    table?: { table_name?: string | null } | null;
    delivery?: { delivery_name?: string | null } | null;
    items_count: number;
};

type DashboardOverview = {
    summary: {
        period_start: string | null;
        period_end: string | null;
        total_sales: number;
        total_orders: number;
        total_discount: number;
        average_order_value: number;
        cash_sales: number;
        qr_sales: number;
        dine_in_sales: number;
        takeaway_sales: number;
        delivery_sales: number;
    };
    daily_sales: SalesSummaryView[];
    top_items: TopSellingItemsView[];
    recent_orders: DashboardRecentOrderSummary[];
};

type TopItemQueryRow = {
    branch_id: string;
    product_id: string;
    display_name: string;
    img_url: string | null;
    category_id: string | null;
    total_quantity: string | number;
    total_revenue: string | number;
};

type RecentOrderQueryRow = {
    id: string;
    order_no: string;
    order_type: string;
    status: string;
    create_date: Date | string;
    update_date: Date | string;
    total_amount: string | number;
    delivery_code: string | null;
    table_name: string | null;
    delivery_name: string | null;
    items_count: string | number;
};

type SalesSummaryQueryRow = {
    branch_id: string;
    date: string;
    total_orders: string | number;
    total_sales: string | number;
    total_discount: string | number;
    cash_sales: string | number;
    qr_sales: string | number;
    dine_in_sales: string | number;
    takeaway_sales: string | number;
    delivery_sales: string | number;
};

type DashboardFilterRange = {
    startDate?: string;
    endDate?: string;
    startAtTs?: string;
    endAtTs?: string;
    periodStart: string | null;
    periodEnd: string | null;
    cacheStart: string;
    cacheEnd: string;
    hasTimePrecision: boolean;
};

export class DashboardService {
    private readonly SALES_CACHE_PREFIX = "dashboard:sales";
    private readonly TOP_ITEMS_CACHE_PREFIX = "dashboard:top-items";
    private readonly OVERVIEW_CACHE_PREFIX = "dashboard:overview";
    private readonly SALES_CACHE_TTL = Number(process.env.DASHBOARD_SALES_CACHE_TTL_MS || 20000);
    private readonly TOP_ITEMS_CACHE_TTL = Number(process.env.DASHBOARD_TOP_ITEMS_CACHE_TTL_MS || 20000);
    private readonly OVERVIEW_CACHE_TTL = Number(process.env.DASHBOARD_OVERVIEW_CACHE_TTL_MS || 20000);
    private readonly dashboardTimeZone = "Asia/Bangkok";
    private readonly dashboardUtcOffset = "+07:00";

    private observeCache(operation: string, result: "hit" | "miss", source?: "memory" | "redis"): void {
        metrics.observeCache({
            cache: "query",
            operation,
            result,
            source: source ?? "none",
        });
    }

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private async buildVersionedCacheKey(
        prefix: string,
        branchId: string | undefined,
        ...parts: Array<string | number | boolean | undefined>
    ): Promise<string> {
        const scope = this.getCacheScopeParts(branchId);
        const versionToken = await getReadModelVersionToken(
            "dashboard",
            scope[0] === "branch" ? scope[1] : undefined
        );
        return cacheKey(prefix, ...scope, versionToken, ...parts);
    }

    private normalizeDateRange(startDate?: string, endDate?: string): { startDate?: string; endDate?: string } {
        const hasStart = typeof startDate === "string" && startDate.length > 0;
        const hasEnd = typeof endDate === "string" && endDate.length > 0;

        if (hasStart !== hasEnd) {
            throw new AppError("startDate and endDate must be provided together", 400);
        }

        if (!hasStart || !hasEnd) {
            return {};
        }

        const start = String(startDate);
        const end = String(endDate);
        const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

        if (!isoDatePattern.test(start) || !isoDatePattern.test(end)) {
            throw new AppError("Invalid date format. Expected YYYY-MM-DD", 400);
        }

        const startValue = Date.parse(`${start}T00:00:00.000Z`);
        const endValue = Date.parse(`${end}T00:00:00.000Z`);

        if (Number.isNaN(startValue) || Number.isNaN(endValue)) {
            throw new AppError("Invalid date range", 400);
        }

        if (startValue > endValue) {
            throw new AppError("startDate cannot be greater than endDate", 400);
        }

        return { startDate: start, endDate: end };
    }

    private normalizeDateTimeRange(startAt?: string, endAt?: string): { startAtTs?: string; endAtTs?: string } {
        const hasStart = typeof startAt === "string" && startAt.length > 0;
        const hasEnd = typeof endAt === "string" && endAt.length > 0;

        if (hasStart !== hasEnd) {
            throw new AppError("startAt and endAt must be provided together", 400);
        }

        if (!hasStart || !hasEnd) {
            return {};
        }

        const startDate = new Date(String(startAt));
        const endDate = new Date(String(endAt));

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            throw new AppError("Invalid date time range", 400);
        }

        if (startDate.getTime() > endDate.getTime()) {
            throw new AppError("startAt cannot be greater than endAt", 400);
        }

        return {
            startAtTs: startDate.toISOString(),
            endAtTs: endDate.toISOString(),
        };
    }

    private toSafeLimit(value: number, fallback: number, max: number): number {
        if (!Number.isFinite(value)) return fallback;
        return Math.min(Math.max(Math.trunc(value), 1), max);
    }

    private toDateRangeBounds(
        startDate?: string,
        endDate?: string
    ): { startAtTs?: string; endAtTs?: string } {
        if (!startDate || !endDate) {
            return {};
        }

        const startAt = new Date(`${startDate}T00:00:00.000${this.dashboardUtcOffset}`);
        const endAt = new Date(`${endDate}T23:59:59.999${this.dashboardUtcOffset}`);

        return {
            startAtTs: startAt.toISOString(),
            endAtTs: endAt.toISOString(),
        };
    }

    private toDashboardDateExpression(column: string): string {
        return `DATE(${column} AT TIME ZONE '${this.dashboardTimeZone}')`;
    }

    private normalizeFilterRange(
        startDate?: string,
        endDate?: string,
        startAt?: string,
        endAt?: string
    ): DashboardFilterRange {
        const normalizedDateTimes = this.normalizeDateTimeRange(startAt, endAt);
        if (normalizedDateTimes.startAtTs && normalizedDateTimes.endAtTs) {
            return {
                startDate: normalizedDateTimes.startAtTs.slice(0, 10),
                endDate: normalizedDateTimes.endAtTs.slice(0, 10),
                startAtTs: normalizedDateTimes.startAtTs,
                endAtTs: normalizedDateTimes.endAtTs,
                periodStart: normalizedDateTimes.startAtTs,
                periodEnd: normalizedDateTimes.endAtTs,
                cacheStart: normalizedDateTimes.startAtTs,
                cacheEnd: normalizedDateTimes.endAtTs,
                hasTimePrecision: true,
            };
        }

        const normalizedDates = this.normalizeDateRange(startDate, endDate);
        const bounds = this.toDateRangeBounds(normalizedDates.startDate, normalizedDates.endDate);
        return {
            startDate: normalizedDates.startDate,
            endDate: normalizedDates.endDate,
            startAtTs: bounds.startAtTs,
            endAtTs: bounds.endAtTs,
            periodStart: normalizedDates.startDate || null,
            periodEnd: normalizedDates.endDate || null,
            cacheStart: normalizedDates.startDate || "all",
            cacheEnd: normalizedDates.endDate || "all",
            hasTimePrecision: false,
        };
    }

    private applyTimestampRange<T extends SelectQueryBuilder<any>>(
        query: T,
        column: string,
        range: DashboardFilterRange
    ): T {
        if (range.startAtTs && range.endAtTs) {
            query.andWhere(`${column} >= :startAtTs AND ${column} <= :endAtTs`, {
                startAtTs: range.startAtTs,
                endAtTs: range.endAtTs,
            });
        }
        return query;
    }

    private mapTopItemRow(row: TopItemQueryRow): TopSellingItemsView {
        return {
            branch_id: row.branch_id,
            product_id: row.product_id,
            display_name: row.display_name || "",
            img_url: row.img_url || "",
            category_id: row.category_id || "",
            total_quantity: Number(row.total_quantity || 0),
            total_revenue: Number(row.total_revenue || 0),
        } as TopSellingItemsView;
    }

    private async getSalesSummaryByRange(
        range: DashboardFilterRange,
        branchId?: string
    ): Promise<SalesSummaryView[]> {
        const orderDailyQuery = getRepository(SalesOrder)
            .createQueryBuilder("order")
            .select("order.branch_id", "branch_id")
            .addSelect(this.toDashboardDateExpression("order.create_date"), "date")
            .addSelect("COUNT(*)::int", "total_orders")
            .addSelect("COALESCE(SUM(order.total_amount), 0)", "total_sales")
            .addSelect("COALESCE(SUM(order.discount_amount), 0)", "total_discount")
            .where("order.status IN (:...statuses)", { statuses: ["Paid", "Completed"] });

        if (branchId) {
            orderDailyQuery.andWhere("order.branch_id = :branchId", { branchId });
        }

        this.applyTimestampRange(orderDailyQuery, "order.create_date", range);

        orderDailyQuery
            .groupBy("order.branch_id")
            .addGroupBy(this.toDashboardDateExpression("order.create_date"));

        const paymentDailyQuery = getRepository(SalesOrder)
            .createQueryBuilder("order")
            .leftJoin(Payments, "payment", "payment.order_id = order.id AND payment.status = :paymentStatus", {
                paymentStatus: "Success",
            })
            .leftJoin(PaymentMethod, "payment_method", "payment.payment_method_id = payment_method.id")
            .select("order.branch_id", "branch_id")
            .addSelect(this.toDashboardDateExpression("order.create_date"), "date")
            .addSelect(
                "COALESCE(SUM(CASE WHEN payment_method.payment_method_name ILIKE '%cash%' OR payment_method.display_name ILIKE '%สด%' THEN payment.amount ELSE 0 END), 0)",
                "cash_sales"
            )
            .addSelect(
                "COALESCE(SUM(CASE WHEN payment_method.payment_method_name ILIKE '%qr%' OR payment_method.payment_method_name ILIKE '%prompt%' THEN payment.amount ELSE 0 END), 0)",
                "qr_sales"
            )
            .addSelect("COALESCE(SUM(CASE WHEN order.order_type = 'DineIn' THEN payment.amount ELSE 0 END), 0)", "dine_in_sales")
            .addSelect("COALESCE(SUM(CASE WHEN order.order_type = 'TakeAway' THEN payment.amount ELSE 0 END), 0)", "takeaway_sales")
            .addSelect("COALESCE(SUM(CASE WHEN order.order_type = 'Delivery' THEN payment.amount ELSE 0 END), 0)", "delivery_sales")
            .where("order.status IN (:...statuses)", { statuses: ["Paid", "Completed"] });

        if (branchId) {
            paymentDailyQuery.andWhere("order.branch_id = :branchId", { branchId });
        }

        this.applyTimestampRange(paymentDailyQuery, "order.create_date", range);

        paymentDailyQuery
            .groupBy("order.branch_id")
            .addGroupBy(this.toDashboardDateExpression("order.create_date"));

        const query = getRepository(SalesOrder).manager
            .createQueryBuilder()
            .select("order_daily.branch_id", "branch_id")
            .addSelect("order_daily.date", "date")
            .addSelect("order_daily.total_orders", "total_orders")
            .addSelect("order_daily.total_sales", "total_sales")
            .addSelect("order_daily.total_discount", "total_discount")
            .addSelect("COALESCE(payment_daily.cash_sales, 0)", "cash_sales")
            .addSelect("COALESCE(payment_daily.qr_sales, 0)", "qr_sales")
            .addSelect("COALESCE(payment_daily.dine_in_sales, 0)", "dine_in_sales")
            .addSelect("COALESCE(payment_daily.takeaway_sales, 0)", "takeaway_sales")
            .addSelect("COALESCE(payment_daily.delivery_sales, 0)", "delivery_sales")
            .from(`(${orderDailyQuery.getQuery()})`, "order_daily")
            .leftJoin(
                `(${paymentDailyQuery.getQuery()})`,
                "payment_daily",
                "payment_daily.branch_id = order_daily.branch_id AND payment_daily.date = order_daily.date"
            )
            .setParameters({
                ...orderDailyQuery.getParameters(),
                ...paymentDailyQuery.getParameters(),
            })
            .orderBy("order_daily.date", "DESC");

        const rows = await query.getRawMany<SalesSummaryQueryRow>();
        return rows.map((row) => ({
            branch_id: row.branch_id,
            date: row.date,
            total_orders: Number(row.total_orders || 0),
            total_sales: Number(row.total_sales || 0),
            total_discount: Number(row.total_discount || 0),
            cash_sales: Number(row.cash_sales || 0),
            qr_sales: Number(row.qr_sales || 0),
            dine_in_sales: Number(row.dine_in_sales || 0),
            takeaway_sales: Number(row.takeaway_sales || 0),
            delivery_sales: Number(row.delivery_sales || 0),
        } as SalesSummaryView));
    }

    async getSalesSummary(
        startDate?: string,
        endDate?: string,
        branchId?: string,
        startAt?: string,
        endAt?: string
    ): Promise<SalesSummaryView[]> {
        const range = this.normalizeFilterRange(startDate, endDate, startAt, endAt);
        const key = await this.buildVersionedCacheKey(
            this.SALES_CACHE_PREFIX,
            branchId,
            range.cacheStart,
            range.cacheEnd
        );

        return withCache(
            key,
            async () => {
                const start = process.hrtime.bigint();
                const rows = await this.getSalesSummaryByRange(range, branchId);
                const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
                await logProfileDuration("dashboard.sales.summary", durationMs);
                return rows;
            },
            this.SALES_CACHE_TTL,
            queryCache as any,
            {
                onHit: (source) => this.observeCache("dashboard.sales.summary", "hit", source),
                onMiss: () => this.observeCache("dashboard.sales.summary", "miss"),
            }
        );
    }

    async getTopSellingItems(limit: number = 10, branchId?: string): Promise<TopSellingItemsView[]> {
        const safeLimit = this.toSafeLimit(limit, 10, 50);
        const key = await this.buildVersionedCacheKey(this.TOP_ITEMS_CACHE_PREFIX, branchId, safeLimit);

        return withCache(
            key,
            async () => {
                const start = process.hrtime.bigint();
                const rows = await this.getTopSellingItemsByRange(safeLimit, branchId);
                const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
                await logProfileDuration("dashboard.top-items", durationMs);
                return rows;
            },
            this.TOP_ITEMS_CACHE_TTL,
            queryCache as any,
            {
                onHit: (source) => this.observeCache("dashboard.top-items", "hit", source),
                onMiss: () => this.observeCache("dashboard.top-items", "miss"),
            }
        );
    }

    private async getTopSellingItemsByRange(
        limit: number,
        branchId?: string,
        range?: DashboardFilterRange
    ): Promise<TopSellingItemsView[]> {
        const topItemsQuery = getRepository(SalesOrderItem)
            .createQueryBuilder("item")
            .innerJoin(SalesOrder, "order", "order.id = item.order_id")
            .leftJoin(Products, "product", "product.id = item.product_id")
            .select("order.branch_id", "branch_id")
            .addSelect("item.product_id", "product_id")
            .addSelect("COALESCE(product.display_name, '')", "display_name")
            .addSelect("COALESCE(product.img_url, '')", "img_url")
            .addSelect("product.category_id", "category_id")
            .addSelect("COALESCE(SUM(item.quantity), 0)::int", "total_quantity")
            .addSelect("COALESCE(SUM(item.total_price), 0)", "total_revenue")
            .where("order.status IN (:...statuses)", { statuses: ["Paid", "Completed"] })
            .andWhere("item.status::text NOT IN ('Cancelled', 'cancelled')");

        if (branchId) {
            topItemsQuery.andWhere("order.branch_id = :branchId", { branchId });
        }

        if (range) {
            this.applyTimestampRange(topItemsQuery, "order.create_date", range);
        }

        topItemsQuery
            .groupBy("order.branch_id")
            .addGroupBy("item.product_id")
            .addGroupBy("product.display_name")
            .addGroupBy("product.img_url")
            .addGroupBy("product.category_id")
            .orderBy("SUM(item.quantity)", "DESC")
            .addOrderBy("SUM(item.total_price)", "DESC")
            .limit(limit);

        const rows = await topItemsQuery.getRawMany<TopItemQueryRow>();
        return rows.map((row) => this.mapTopItemRow(row));
    }

    private async getRecentOrdersSummary(
        limit: number,
        branchId?: string,
        range?: DashboardFilterRange
    ): Promise<DashboardRecentOrderSummary[]> {
        const itemCountSubquery = getRepository(SalesOrderItem)
            .createQueryBuilder("item_count")
            .select("item_count.order_id", "order_id")
            .addSelect("COALESCE(SUM(item_count.quantity), 0)::int", "items_count")
            .where("item_count.status::text NOT IN ('Cancelled', 'cancelled')")
            .groupBy("item_count.order_id");

        const recentOrdersQuery = getRepository(SalesOrder)
            .createQueryBuilder("order")
            .leftJoin("order.table", "table")
            .leftJoin("order.delivery", "delivery")
            .leftJoin(
                `(${itemCountSubquery.getQuery()})`,
                "item_counts",
                "item_counts.order_id = order.id"
            )
            .select("order.id", "id")
            .addSelect("order.order_no", "order_no")
            .addSelect("order.order_type", "order_type")
            .addSelect("order.status", "status")
            .addSelect("order.create_date", "create_date")
            .addSelect("order.update_date", "update_date")
            .addSelect("order.total_amount", "total_amount")
            .addSelect("order.delivery_code", "delivery_code")
            .addSelect("table.table_name", "table_name")
            .addSelect("delivery.delivery_name", "delivery_name")
            .addSelect("COALESCE(item_counts.items_count, 0)", "items_count")
            .where("order.status IN (:...statuses)", {
                statuses: ["Paid", "Completed", "Cancelled"],
            })
            .setParameters(itemCountSubquery.getParameters());

        if (branchId) {
            recentOrdersQuery.andWhere("order.branch_id = :branchId", { branchId });
        }

        if (range) {
            this.applyTimestampRange(recentOrdersQuery, "order.update_date", range);
        }

        recentOrdersQuery
            .orderBy("order.update_date", "DESC")
            .limit(limit);

        const rows = await recentOrdersQuery.getRawMany<RecentOrderQueryRow>();
        if (rows.length === 0) {
            return [];
        }

        return rows.map((row) => ({
            id: row.id,
            order_no: row.order_no,
            order_type: row.order_type,
            status: row.status,
            create_date: row.create_date instanceof Date ? row.create_date.toISOString() : String(row.create_date),
            update_date: row.update_date instanceof Date ? row.update_date.toISOString() : String(row.update_date),
            total_amount: Number(row.total_amount || 0),
            delivery_code: row.delivery_code,
            table: row.table_name ? { table_name: row.table_name } : null,
            delivery: row.delivery_name ? { delivery_name: row.delivery_name } : null,
            items_count: Number(row.items_count || 0),
        }));
    }

    async getOverview(
        startDate?: string,
        endDate?: string,
        branchId?: string,
        topLimit: number = 7,
        recentLimit: number = 8,
        startAt?: string,
        endAt?: string
    ): Promise<DashboardOverview> {
        const range = this.normalizeFilterRange(startDate, endDate, startAt, endAt);
        const safeTopLimit = this.toSafeLimit(topLimit, 7, 20);
        const safeRecentLimit = this.toSafeLimit(recentLimit, 8, 30);
        const key = await this.buildVersionedCacheKey(
            this.OVERVIEW_CACHE_PREFIX,
            branchId,
            range.cacheStart,
            range.cacheEnd,
            safeTopLimit,
            safeRecentLimit
        );

        return withCache(
            key,
            async () => {
                const [summaryRows, topItems, recentOrders] = await Promise.all([
                    this.getSalesSummary(range.startDate, range.endDate, branchId, range.startAtTs, range.endAtTs),
                    range.startAtTs && range.endAtTs
                        ? this.getTopSellingItemsByRange(
                            safeTopLimit,
                            branchId,
                            range
                        )
                        : this.getTopSellingItems(safeTopLimit, branchId),
                    this.getRecentOrdersSummary(
                        safeRecentLimit,
                        branchId,
                        range
                    ),
                ]);

                const dailySales = [...summaryRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
                const aggregated = dailySales.reduce(
                    (acc, row) => {
                        acc.total_sales += Number(row.total_sales || 0);
                        acc.total_orders += Number(row.total_orders || 0);
                        acc.total_discount += Number(row.total_discount || 0);
                        acc.cash_sales += Number(row.cash_sales || 0);
                        acc.qr_sales += Number(row.qr_sales || 0);
                        acc.dine_in_sales += Number(row.dine_in_sales || 0);
                        acc.takeaway_sales += Number(row.takeaway_sales || 0);
                        acc.delivery_sales += Number(row.delivery_sales || 0);
                        return acc;
                    },
                    {
                        total_sales: 0,
                        total_orders: 0,
                        total_discount: 0,
                        cash_sales: 0,
                        qr_sales: 0,
                        dine_in_sales: 0,
                        takeaway_sales: 0,
                        delivery_sales: 0,
                    }
                );

                const avgOrderValue =
                    aggregated.total_orders > 0 ? aggregated.total_sales / aggregated.total_orders : 0;

                return {
                    summary: {
                        period_start: range.periodStart,
                        period_end: range.periodEnd,
                        total_sales: aggregated.total_sales,
                        total_orders: aggregated.total_orders,
                        total_discount: aggregated.total_discount,
                        average_order_value: avgOrderValue,
                        cash_sales: aggregated.cash_sales,
                        qr_sales: aggregated.qr_sales,
                        dine_in_sales: aggregated.dine_in_sales,
                        takeaway_sales: aggregated.takeaway_sales,
                        delivery_sales: aggregated.delivery_sales,
                    },
                    daily_sales: dailySales,
                    top_items: topItems,
                    recent_orders: recentOrders,
                };
            },
            this.OVERVIEW_CACHE_TTL,
            queryCache as any,
            {
                onHit: (source) => this.observeCache("dashboard.overview", "hit", source),
                onMiss: () => this.observeCache("dashboard.overview", "miss"),
            }
        );
    }
}
