import { SalesSummaryView } from "../../entity/pos/views/SalesSummaryView";
import { TopSellingItemsView } from "../../entity/pos/views/TopSellingItemsView";
import { getDbContext, getRepository } from "../../database/dbContext";
import { cacheKey, queryCache, withCache } from "../../utils/cache";
import { logProfileDuration } from "../../utils/queryProfiler";
import { metrics } from "../../utils/metrics";

export class DashboardService {
    private readonly SALES_CACHE_PREFIX = "dashboard:sales";
    private readonly TOP_ITEMS_CACHE_PREFIX = "dashboard:top-items";
    private readonly SALES_CACHE_TTL = Number(process.env.DASHBOARD_SALES_CACHE_TTL_MS || 15000);
    private readonly TOP_ITEMS_CACHE_TTL = Number(process.env.DASHBOARD_TOP_ITEMS_CACHE_TTL_MS || 15000);

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

    async getSalesSummary(startDate?: string, endDate?: string, branchId?: string): Promise<SalesSummaryView[]> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(
            this.SALES_CACHE_PREFIX,
            ...scope,
            startDate || "all",
            endDate || "all"
        );

        return withCache(
            key,
            async () => {
                const salesRepository = getRepository(SalesSummaryView);
                const query = salesRepository.createQueryBuilder("sales");

                if (startDate && endDate) {
                    query.where("sales.date BETWEEN :startDate AND :endDate", { startDate, endDate });
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
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.TOP_ITEMS_CACHE_PREFIX, ...scope, limit);

        return withCache(
            key,
            async () => {
                const topItemsRepository = getRepository(TopSellingItemsView);
                const start = process.hrtime.bigint();
                const rows = await topItemsRepository.find({
                    where: branchId ? ({ branch_id: branchId } as any) : undefined,
                    order: {
                        total_quantity: "DESC"
                    },
                    take: limit
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
}
