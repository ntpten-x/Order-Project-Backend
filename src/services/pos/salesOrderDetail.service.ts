import { SalesOrderDetailModels } from "../../models/pos/salesOrderDetail.model";
import { SocketService } from "../socket.service";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { recalculateOrderTotal } from "./orderTotals.service";
import { getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { AppError } from "../../utils/AppError";

type AccessContext = {
    scope?: "none" | "own" | "branch" | "all";
    actorUserId?: string;
};

export class SalesOrderDetailService {
    private socketService = SocketService.getInstance();

    constructor(private salesOrderDetailModel: SalesOrderDetailModels) { }

    private async findAccessibleItem(
        ordersItemId: string,
        branchId?: string,
        access?: AccessContext,
    ): Promise<SalesOrderItem | null> {
        const itemRepo = getRepository(SalesOrderItem);
        const query = itemRepo
            .createQueryBuilder("item")
            .innerJoin("item.order", "order")
            .where("item.id = :id", { id: ordersItemId });

        if (branchId) {
            query.andWhere("order.branch_id = :branchId", { branchId });
        }

        if (access?.scope === "none") {
            query.andWhere("1=0");
        }

        if (access?.scope === "own") {
            if (!access.actorUserId) {
                query.andWhere("1=0");
            } else {
                query.andWhere("order.created_by_id = :actorUserId", { actorUserId: access.actorUserId });
            }
        }

        return query.getOne();
    }

    private async recalcByItemId(ordersItemId?: string | null): Promise<void> {
        if (!ordersItemId) return;
        const itemRepo = getRepository(SalesOrderItem);
        const item = await itemRepo.findOneBy({ id: ordersItemId });
        if (item) {
            await recalculateOrderTotal(item.order_id);
        }
    }

    async findAll(branchId?: string, access?: AccessContext): Promise<SalesOrderDetail[]> {
        try {
            return this.salesOrderDetailModel.findAll(branchId, access)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string, access?: AccessContext): Promise<SalesOrderDetail | null> {
        try {
            return this.salesOrderDetailModel.findOne(id, branchId, access)
        } catch (error) {
            throw error
        }
    }

    async create(salesOrderDetail: SalesOrderDetail, branchId?: string, access?: AccessContext): Promise<SalesOrderDetail> {
        try {
            if (!salesOrderDetail.orders_item_id) {
                throw new Error("กรุณาระบุรหัสรายการสินค้าแม่ข่าย")
            }

            if (branchId || access?.scope) {
                const item = await this.findAccessibleItem(salesOrderDetail.orders_item_id, branchId, access);
                if (!item) {
                    if (access?.scope === "own" || access?.scope === "none") {
                        throw AppError.forbidden("Access denied");
                    }
                    throw AppError.notFound("Order item");
                }
            }

            const createdDetail = await this.salesOrderDetailModel.create(salesOrderDetail)
            await this.recalcByItemId(createdDetail.orders_item_id);

            const completeDetail = await this.salesOrderDetailModel.findOne(createdDetail.id, branchId, access)
            if (completeDetail) {
                if (branchId) {
                    this.socketService.emitToBranch(branchId, RealtimeEvents.salesOrderDetail.create, completeDetail)
                }
                return completeDetail
            }
            return createdDetail
        } catch (error) {
            throw error
        }
    }

    async update(id: string, salesOrderDetail: SalesOrderDetail, branchId?: string, access?: AccessContext): Promise<SalesOrderDetail> {
        try {
            const detailToUpdate = await this.salesOrderDetailModel.findOne(id, branchId, access)
            if (!detailToUpdate) {
                throw new Error("ไม่พบรายละเอียดเพิ่มเติมที่ต้องการแก้ไข")
            }

            const updatedDetail = await this.salesOrderDetailModel.update(id, salesOrderDetail, branchId, access)
            await this.recalcByItemId(detailToUpdate.orders_item_id);
            if (branchId) {
                this.socketService.emitToBranch(branchId, RealtimeEvents.salesOrderDetail.update, updatedDetail)
            }
            return updatedDetail
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string, access?: AccessContext): Promise<void> {
        try {
            const detailToDelete = await this.salesOrderDetailModel.findOne(id, branchId, access)
            await this.salesOrderDetailModel.delete(id, branchId, access)
            await this.recalcByItemId(detailToDelete?.orders_item_id);
            if (branchId) {
                this.socketService.emitToBranch(branchId, RealtimeEvents.salesOrderDetail.delete, { id })
            }
        } catch (error) {
            throw error
        }
    }
}
