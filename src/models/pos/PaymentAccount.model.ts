import { ShopPaymentAccount } from "../../entity/pos/ShopPaymentAccount"
import { getRepository } from "../../database/dbContext"

export class PaymentAccountModel {
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
