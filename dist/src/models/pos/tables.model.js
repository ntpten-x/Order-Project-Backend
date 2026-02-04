"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TablesModels = void 0;
const Tables_1 = require("../../entity/pos/Tables");
const dbContext_1 = require("../../database/dbContext");
class TablesModels {
    findAll() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 50, q, branchId) {
            try {
                const skip = (page - 1) * limit;
                const tablesRepository = (0, dbContext_1.getRepository)(Tables_1.Tables);
                const query = tablesRepository.createQueryBuilder("tables")
                    .leftJoinAndMapOne("tables.active_order", "SalesOrder", "so", "so.table_id = tables.id AND so.status NOT IN (:...statuses)", { statuses: ['Paid', 'Cancelled', 'completed'] })
                    .orderBy("tables.create_date", "ASC");
                if (q && q.trim()) {
                    query.andWhere("tables.table_name ILIKE :q", { q: `%${q.trim()}%` });
                }
                if (branchId) {
                    query.andWhere("tables.branch_id = :branchId", { branchId });
                }
                const [rows, total] = yield query.skip(skip).take(limit).getManyAndCount();
                const data = rows.map((t) => {
                    const activeOrder = t.active_order;
                    return Object.assign(Object.assign({}, t), { status: activeOrder ? "Unavailable" : t.status, active_order_status: (activeOrder === null || activeOrder === void 0 ? void 0 : activeOrder.status) || null, active_order_id: (activeOrder === null || activeOrder === void 0 ? void 0 : activeOrder.id) || null });
                });
                return {
                    data,
                    total,
                    page,
                    last_page: Math.max(1, Math.ceil(total / limit))
                };
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return (0, dbContext_1.getRepository)(Tables_1.Tables).findOneBy(branchId ? { id, branch_id: branchId } : { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(table_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const where = { table_name };
                if (branchId)
                    where.branch_id = branchId;
                return (0, dbContext_1.getRepository)(Tables_1.Tables).findOneBy(where);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return (0, dbContext_1.getRepository)(Tables_1.Tables).save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (branchId) {
                    yield (0, dbContext_1.getRepository)(Tables_1.Tables).update({ id, branch_id: branchId }, data);
                }
                else {
                    yield (0, dbContext_1.getRepository)(Tables_1.Tables).update(id, data);
                }
                const updatedTable = yield this.findOne(id, branchId);
                if (!updatedTable) {
                    throw new Error("ไม่พบข้อมูลโต๊ะที่ต้องการค้นหา");
                }
                return updatedTable;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (branchId) {
                    yield (0, dbContext_1.getRepository)(Tables_1.Tables).delete({ id, branch_id: branchId });
                }
                else {
                    yield (0, dbContext_1.getRepository)(Tables_1.Tables).delete(id);
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.TablesModels = TablesModels;
