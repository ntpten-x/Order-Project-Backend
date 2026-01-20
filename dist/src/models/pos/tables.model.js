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
const database_1 = require("../../database/database");
const Tables_1 = require("../../entity/pos/Tables");
class TablesModels {
    constructor() {
        this.tablesRepository = database_1.AppDataSource.getRepository(Tables_1.Tables);
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.tablesRepository.createQueryBuilder("tables")
                    .leftJoinAndMapOne("tables.active_order", "Orders", "orders", "orders.table_id = tables.id AND orders.status NOT IN (:...statuses)", { statuses: ['Paid', 'Cancelled', 'completed'] }) // Exclude 'completed' too just in case
                    .orderBy("tables.create_date", "ASC")
                    .getMany()
                    .then(tables => tables.map((t) => {
                    const activeOrder = t.active_order;
                    return Object.assign(Object.assign({}, t), { status: activeOrder ? "Unavailable" : t.status, active_order_status: (activeOrder === null || activeOrder === void 0 ? void 0 : activeOrder.status) || null });
                }));
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.tablesRepository.findOneBy({ id });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(table_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.tablesRepository.findOneBy({ table_name });
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.tablesRepository.save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.tablesRepository.update(id, data);
                const updatedTable = yield this.findOne(id);
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
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.tablesRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.TablesModels = TablesModels;
