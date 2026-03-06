import { ShopPaymentAccount } from "../../entity/pos/ShopPaymentAccount"
import { getRepository } from "../../database/dbContext"

export class PaymentAccountModel {
    async findAll(
        shopId: string,
        branchId?: string,
        page: number = 1,
        limit: number = 50,
        q?: string,
        filters?: { status?: "active" | "inactive" }
    ): Promise<{ data: ShopPaymentAccount[]; total: number; page: number; last_page: number }> {
        const skip = (page - 1) * limit;
        const repository = getRepository(ShopPaymentAccount);
        const query = repository.createQueryBuilder("account")
            .where(branchId ? "account.shop_id = :shopId AND account.branch_id = :branchId" : "account.shop_id = :shopId", { shopId, branchId })
            .orderBy("account.is_active", "DESC")
            .addOrderBy("account.created_at", "DESC");

        if (q && q.trim()) {
            query.andWhere("(account.account_name ILIKE :q OR account.account_number ILIKE :q)", { q: `%${q.trim()}%` });
        }

        if (filters?.status === "active") {
            query.andWhere("account.is_active = true");
        } else if (filters?.status === "inactive") {
            query.andWhere("account.is_active = false");
        }

        const [data, total] = await query.skip(skip).take(limit).getManyAndCount();

        return {
            data,
            total,
            page,
            last_page: Math.max(1, Math.ceil(total / limit)),
        };
    }

    // Deprecated: use findAll instead
    async findByShopId(shopId: string, branchId?: string) {
        return await getRepository(ShopPaymentAccount).find({
            where: branchId ? { shop_id: shopId, branch_id: branchId } : { shop_id: shopId },
            order: { is_active: "DESC", created_at: "DESC" }
        })
    }

    async findOne(shopId: string, accountId: string, branchId?: string) {
        return await getRepository(ShopPaymentAccount).findOne({
            where: branchId ? { id: accountId, shop_id: shopId, branch_id: branchId } : { id: accountId, shop_id: shopId }
        })
    }

    async findByAccountNumber(shopId: string, accountNumber: string, branchId?: string) {
        return await getRepository(ShopPaymentAccount).findOne({
            where: branchId
                ? { shop_id: shopId, account_number: accountNumber, branch_id: branchId }
                : { shop_id: shopId, account_number: accountNumber }
        })
    }

    async create(data: Partial<ShopPaymentAccount>) {
        const repository = getRepository(ShopPaymentAccount)
        const account = repository.create(data)
        return await repository.save(account)
    }

    async save(account: ShopPaymentAccount) {
        return await getRepository(ShopPaymentAccount).save(account)
    }

    async deactivateAll(shopId: string, branchId?: string) {
        return await getRepository(ShopPaymentAccount).update(
            branchId ? { shop_id: shopId, branch_id: branchId } : { shop_id: shopId },
            { is_active: false }
        )
    }

    async delete(account: ShopPaymentAccount) {
        return await getRepository(ShopPaymentAccount).remove(account)
    }

    async count(shopId: string, branchId?: string) {
        return await getRepository(ShopPaymentAccount).count({
            where: branchId ? { shop_id: shopId, branch_id: branchId } : { shop_id: shopId }
        })
    }
}
