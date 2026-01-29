import { Repository } from "typeorm"
import { AppDataSource } from "../../database/database"
import { ShopPaymentAccount } from "../../entity/pos/ShopPaymentAccount"
import { CreatePaymentAccountDto } from "../../schemas/paymentAccount.schema"

export class PaymentAccountModel {
    private repository: Repository<ShopPaymentAccount>

    constructor() {
        this.repository = AppDataSource.getRepository(ShopPaymentAccount)
    }

    async findByShopId(shopId: string) {
        return await this.repository.find({
            where: { shop_id: shopId },
            order: { is_active: "DESC", created_at: "DESC" }
        })
    }

    async findOne(shopId: string, accountId: string) {
        return await this.repository.findOne({ where: { id: accountId, shop_id: shopId } })
    }

    async findByAccountNumber(shopId: string, accountNumber: string) {
        return await this.repository.findOne({
            where: { shop_id: shopId, account_number: accountNumber }
        })
    }

    async create(data: Partial<ShopPaymentAccount>) {
        const account = this.repository.create(data)
        return await this.repository.save(account)
    }

    async save(account: ShopPaymentAccount) {
        return await this.repository.save(account)
    }

    async deactivateAll(shopId: string) {
        return await this.repository.update({ shop_id: shopId }, { is_active: false })
    }

    async delete(account: ShopPaymentAccount) {
        return await this.repository.remove(account)
    }

    async count(shopId: string) {
        return await this.repository.count({ where: { shop_id: shopId } })
    }
}
