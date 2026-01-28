import { AppDataSource } from "../../database/database";
import { SalesSummaryView } from "../../entity/pos/views/SalesSummaryView";
import { TopSellingItemsView } from "../../entity/pos/views/TopSellingItemsView";

export class DashboardService {
    async getSalesSummary(startDate?: string, endDate?: string): Promise<SalesSummaryView[]> {
        const salesRepository = AppDataSource.getRepository(SalesSummaryView);
        const query = salesRepository.createQueryBuilder("sales");

        if (startDate && endDate) {
            query.where("sales.date BETWEEN :startDate AND :endDate", { startDate, endDate });
        }

        query.orderBy("sales.date", "DESC");

        return await query.getMany();
    }

    async getTopSellingItems(limit: number = 10): Promise<TopSellingItemsView[]> {
        const topItemsRepository = AppDataSource.getRepository(TopSellingItemsView);
        return await topItemsRepository.find({
            order: {
                total_quantity: "DESC"
            },
            take: limit
        });
    }
}
