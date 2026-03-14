import { SelectQueryBuilder } from "typeorm";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { getRepository } from "../../database/dbContext";

type AccessContext = {
    scope?: "none" | "own" | "branch" | "all";
    actorUserId?: string;
};

export class SalesOrderDetailModels {
    private applyAccessScope(query: SelectQueryBuilder<SalesOrderDetail>, access?: AccessContext): void {
        if (access?.scope === "none") {
            query.andWhere("1=0");
            return;
        }

        if (access?.scope === "own") {
            if (!access.actorUserId) {
                query.andWhere("1=0");
                return;
            }

            query.andWhere("order.created_by_id = :actorUserId", { actorUserId: access.actorUserId });
        }
    }

    async findAll(branchId?: string, access?: AccessContext): Promise<SalesOrderDetail[]> {
        const repository = getRepository(SalesOrderDetail);
        const query = repository
            .createQueryBuilder("detail")
            .leftJoinAndSelect("detail.sales_order_item", "item")
            .leftJoinAndSelect("detail.topping", "topping")
            .leftJoinAndSelect("item.order", "order")
            .orderBy("detail.create_date", "ASC");

        if (branchId) {
            query.andWhere("order.branch_id = :branchId", { branchId });
        }

        this.applyAccessScope(query, access);
        return query.getMany();
    }

    async findOne(id: string, branchId?: string, access?: AccessContext): Promise<SalesOrderDetail | null> {
        const repository = getRepository(SalesOrderDetail);
        const query = repository
            .createQueryBuilder("detail")
            .leftJoinAndSelect("detail.sales_order_item", "item")
            .leftJoinAndSelect("detail.topping", "topping")
            .leftJoinAndSelect("item.order", "order")
            .where("detail.id = :id", { id });

        if (branchId) {
            query.andWhere("order.branch_id = :branchId", { branchId });
        }

        this.applyAccessScope(query, access);
        return query.getOne();
    }

    async create(data: SalesOrderDetail): Promise<SalesOrderDetail> {
        return getRepository(SalesOrderDetail).save(data);
    }

    async update(id: string, data: SalesOrderDetail, branchId?: string, access?: AccessContext): Promise<SalesOrderDetail> {
        if (branchId || access?.scope) {
            const scopedExisting = await this.findOne(id, branchId, access);
            if (!scopedExisting) {
                throw new Error("Detail not found");
            }
        }

        const repository = getRepository(SalesOrderDetail);
        const existing = await repository.findOneBy({ id });
        if (!existing) {
            throw new Error("Detail not found");
        }

        repository.merge(existing, data);
        await repository.save(existing);

        const updatedDetail = await this.findOne(id, branchId, access);
        if (!updatedDetail) {
            throw new Error("Detail not found after update");
        }

        return updatedDetail;
    }

    async delete(id: string, branchId?: string, access?: AccessContext): Promise<void> {
        if (branchId || access?.scope) {
            const existing = await this.findOne(id, branchId, access);
            if (!existing) {
                throw new Error("Detail not found");
            }
        }

        await getRepository(SalesOrderDetail).delete(id);
    }
}
