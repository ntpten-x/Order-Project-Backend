import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { Products } from "../../entity/pos/Products";
import { SalesSummaryView } from "../../entity/pos/views/SalesSummaryView";
import { TopSellingItemsView } from "../../entity/pos/views/TopSellingItemsView";
import { getDbContext, getRepository } from "../../database/dbContext";
import { cacheKey, queryCache, withCache } from "../../utils/cache";
import { AppError } from "../../utils/AppError";
import { metrics } from "../../utils/metrics";
import { logProfileDuration } from "../../utils/queryProfiler";

export type DashboardRecentOrderSummary = {
    id: string;
    order_no: string;
    order_type: string;
    status: string;
    create_date: string;
    total_amount: number;
    delivery_code?: string | null;
    table?: { table_name?: string | null } | null;
    delivery?: { delivery_name?: string | null } | null;
    items_count: number;
};

export type DashboardOverview = {
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
    product_name: string;
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
    total_amount: string | number;
    delivery_code: string | null;
    table_name: string | null;
    delivery_name: string | null;
    items_count: string | number;
};

export class DashboardService {
    private readonly SALES_CACHE_PREFIX = "dashboard:sales";
    private readonly TOP_ITEMS_CACHE_PREFIX = "dashboard:top-items";
    private readonly OVERVIEW_CACHE_PREFIX = "dashboard:overview";
    private readonly SALES_CACHE_TTL = Number(process.env.DASHBOARD_SALES_CACHE_TTL_MS || 15000);
    private readonly TOP_ITEMS_CACHE_TTL = Number(process.env.DASHBOARD_TOP_ITEMS_CACHE_TTL_MS || 15000);
    private readonly OVERVIEW_CACHE_TTL = Number(process.env.DASHBOARD_OVERVIEW_CACHE_TTL_MS || 15000);

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

    private toSafeLimit(value: number, fallback: number, max: number): number {
        if (!Number.isFinite(value)) return fallback;
        return Math.min(Math.max(Math.trunc(value), 1), max);
    }

    private buildTimestampRange(startDate?: string, endDate?: string): {
        startTs?: string;
        endExclusiveTs?: string;
    } {
        if (!startDate || !endDate) return {};

        const startTs = `${startDate}T00:00:00.000Z`;
        const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

        return {
            startTs,
            endExclusiveTs: endExclusive.toISOString(),
        };
    }

    async getSalesSummary(startDate?: string, endDate?: string, branchId?: string): Promise<SalesSummaryView[]> {
        const normalized = this.normalizeDateRange(startDate, endDate);
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(
            this.SALES_CACHE_PREFIX,
            ...scope,
            normalized.startDate || "all",
            normalized.endDate || "all"
        );

        return withCache(
            key,
            async () => {
                const salesRepository = getRepository(SalesSummaryView);
                const query = salesRepository.createQueryBuilder("sales");

                if (normalized.startDate && normalized.endDate) {
                    query.where("sales.date BETWEEN :startDate AND :endDate", {
                        startDate: normalized.startDate,
                        endDate: normalized.endDate,
                    });
                }

                if (branchId) {
                    query.andWhere("sales.branch_id = :branchId", { branchId });
                }

                query.orderBy("sales.date", "DESC");

                const start = process.hrtime.bigint();
                const rows = await query.getMany();
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
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.TOP_ITEMS_CACHE_PREFIX, ...scope, safeLimit);

        return withCache(
            key,
            async () => {
                const topItemsRepository = getRepository(TopSellingItemsView);
                const start = process.hrtime.bigint();
                const rows = await topItemsRepository.find({
                    where: branchId ? ({ branch_id: branchId } as any) : undefined,
                    order: {
                        total_quantity: "DESC",
                    },
                    take: safeLimit,
                });
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
        startDate?: string,
        endDate?: string
    ): Promise<TopSellingItemsView[]> {
        const range = this.buildTimestampRange(startDate, endDate);
        const topItemsQuery = getRepository(SalesOrderItem)
            .createQueryBuilder("item")
            .innerJoin(SalesOrder, "order", "order.id = item.order_id")
            .leftJoin(Products, "product", "product.id = item.product_id")
            .select("order.branch_id", "branch_id")
            .addSelect("item.product_id", "product_id")
            .addSelect("COALESCE(product.display_name, '')", "product_name")
            .addSelect("COALESCE(product.img_url, '')", "img_url")
            .addSelect("product.category_id", "category_id")
            .addSelect("COALESCE(SUM(item.quantity), 0)::int", "total_quantity")
            .addSelect("COALESCE(SUM(item.total_price), 0)", "total_revenue")
            .where("order.status IN (:...statuses)", { statuses: ["Paid", "Completed"] })
            .andWhere("item.status::text NOT IN ('Cancelled', 'cancelled')");

        if (branchId) {
            topItemsQuery.andWhere("order.branch_id = :branchId", { branchId });
        }

        if (range.startTs && range.endExclusiveTs) {
            topItemsQuery.andWhere("order.create_date >= :startTs AND order.create_date < :endExclusiveTs", {
                startTs: range.startTs,
                endExclusiveTs: range.endExclusiveTs,
            });
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
        return rows.map((row) => ({
            branch_id: row.branch_id,
            product_id: row.product_id,
            product_name: row.product_name || "",
            img_url: row.img_url || "",
            category_id: row.category_id || "",
            total_quantity: Number(row.total_quantity || 0),
            total_revenue: Number(row.total_revenue || 0),
        })) as TopSellingItemsView[];
    }

    private async getRecentOrdersSummary(
        limit: number,
        branchId?: string,
        startDate?: string,
        endDate?: string
    ): Promise<DashboardRecentOrderSummary[]> {
        const range = this.buildTimestampRange(startDate, endDate);
        const recentOrdersQuery = getRepository(SalesOrder)
            .createQueryBuilder("order")
            .leftJoin("order.table", "table")
            .leftJoin("order.delivery", "delivery")
            .leftJoin(
                SalesOrderItem,
                "item",
                "item.order_id = order.id AND item.status::text NOT IN ('Cancelled', 'cancelled')"
            )
            .select("order.id", "id")
            .addSelect("order.order_no", "order_no")
            .addSelect("order.order_type", "order_type")
            .addSelect("order.status", "status")
            .addSelect("order.create_date", "create_date")
            .addSelect("order.total_amount", "total_amount")
            .addSelect("order.delivery_code", "delivery_code")
            .addSelect("table.table_name", "table_name")
            .addSelect("delivery.delivery_name", "delivery_name")
            .addSelect("COALESCE(SUM(item.quantity), 0)::int", "items_count")
            .where("order.status IN (:...statuses)", {
                statuses: ["Paid", "Completed", "Cancelled"],
            });

        if (branchId) {
            recentOrdersQuery.andWhere("order.branch_id = :branchId", { branchId });
        }

        if (range.startTs && range.endExclusiveTs) {
            recentOrdersQuery.andWhere("order.create_date >= :startTs AND order.create_date < :endExclusiveTs", {
                startTs: range.startTs,
                endExclusiveTs: range.endExclusiveTs,
            });
        }

        recentOrdersQuery
            .groupBy("order.id")
            .addGroupBy("order.order_no")
            .addGroupBy("order.order_type")
            .addGroupBy("order.status")
            .addGroupBy("order.create_date")
            .addGroupBy("order.total_amount")
            .addGroupBy("order.delivery_code")
            .addGroupBy("table.table_name")
            .addGroupBy("delivery.delivery_name")
            .orderBy("order.create_date", "DESC")
            .limit(limit);

        const rows = await recentOrdersQuery.getRawMany<RecentOrderQueryRow>();
        return rows.map((row) => ({
            id: row.id,
            order_no: row.order_no,
            order_type: row.order_type,
            status: row.status,
            create_date: row.create_date instanceof Date ? row.create_date.toISOString() : String(row.create_date),
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
        recentLimit: number = 8
    ): Promise<DashboardOverview> {
        const normalized = this.normalizeDateRange(startDate, endDate);
        const safeTopLimit = this.toSafeLimit(topLimit, 7, 20);
        const safeRecentLimit = this.toSafeLimit(recentLimit, 8, 30);
        const scope = this.getCacheScopeParts(branchId);

        const key = cacheKey(
            this.OVERVIEW_CACHE_PREFIX,
            ...scope,
            normalized.startDate || "all",
            normalized.endDate || "all",
            safeTopLimit,
            safeRecentLimit
        );

        return withCache(
            key,
            async () => {
                const [summaryRows, topItems, recentOrders] = await Promise.all([
                    this.getSalesSummary(normalized.startDate, normalized.endDate, branchId),
                    this.getTopSellingItemsByRange(
                        safeTopLimit,
                        branchId,
                        normalized.startDate,
                        normalized.endDate
                    ),
                    this.getRecentOrdersSummary(
                        safeRecentLimit,
                        branchId,
                        normalized.startDate,
                        normalized.endDate
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
                        period_start: normalized.startDate || null,
                        period_end: normalized.endDate || null,
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
