import { SalesSummaryView } from "../../entity/pos/views/SalesSummaryView";
import { TopSellingItemsView } from "../../entity/pos/views/TopSellingItemsView";
import { getRepository } from "../../database/dbContext";

export class DashboardService {
    async getSalesSummary(startDate?: string, endDate?: string, branchId?: string): Promise<SalesSummaryView[]> {
        const salesRepository = getRepository(SalesSummaryView);
        const query = salesRepository.createQueryBuilder("sales");

        if (startDate && endDate) {
            query.where("sales.date BETWEEN :startDate AND :endDate", { startDate, endDate });
        }

        if (branchId) {
            query.andWhere("sales.branch_id = :branchId", { branchId });
        }

        query.orderBy("sales.date", "DESC");

        return await query.getMany();
    }

    async getTopSellingItems(limit: number = 10, branchId?: string): Promise<TopSellingItemsView[]> {
        const topItemsRepository = getRepository(TopSellingItemsView);
        return await topItemsRepository.find({
            where: branchId ? ({ branch_id: branchId } as any) : undefined,
            order: {
                total_quantity: "DESC"
            },
            take: limit
        });
    }
}
