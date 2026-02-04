import { ShopPaymentAccount } from "../../entity/pos/ShopPaymentAccount"
import { getRepository } from "../../database/dbContext"

export class PaymentAccountModel {
    async findByShopId(shopId: string) {
        return await getRepository(ShopPaymentAccount).find({
            where: { shop_id: shopId },
            order: { is_active: "DESC", created_at: "DESC" }
        })
    }

    async findOne(shopId: string, accountId: string) {
        return await getRepository(ShopPaymentAccount).findOne({ where: { id: accountId, shop_id: shopId } })
    }

    async findByAccountNumber(shopId: string, accountNumber: string) {
        return await getRepository(ShopPaymentAccount).findOne({
            where: { shop_id: shopId, account_number: accountNumber }
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

    async deactivateAll(shopId: string) {
        return await getRepository(ShopPaymentAccount).update({ shop_id: shopId }, { is_active: false })
    }

    async delete(account: ShopPaymentAccount) {
        return await getRepository(ShopPaymentAccount).remove(account)
    }

    async count(shopId: string) {
        return await getRepository(ShopPaymentAccount).count({ where: { shop_id: shopId } })
    }
}
