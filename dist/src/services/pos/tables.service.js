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
exports.TablesService = void 0;
const socket_service_1 = require("../socket.service");
const realtimeEvents_1 = require("../../utils/realtimeEvents");
class TablesService {
    constructor(tablesModel) {
        this.tablesModel = tablesModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll(page, limit, q, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.tablesModel.findAll(page, limit, q, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.tablesModel.findOne(id, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(table_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.tablesModel.findOneByName(table_name, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(tables) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!tables.table_name) {
                    throw new Error("กรุณาระบุชื่อโต๊ะ");
                }
                const existingTable = yield this.tablesModel.findOneByName(tables.table_name, tables.branch_id);
                if (existingTable) {
                    throw new Error("ชื่อโต๊ะนี้มีอยู่ในระบบแล้ว");
                }
                const createdTable = yield this.tablesModel.create(tables);
                if (createdTable.branch_id) {
                    this.socketService.emitToBranch(createdTable.branch_id, realtimeEvents_1.RealtimeEvents.tables.create, createdTable);
                }
                return createdTable;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, tables, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const tableToUpdate = yield this.tablesModel.findOne(id, branchId);
                if (!tableToUpdate) {
                    throw new Error("ไม่พบข้อมูลโต๊ะที่ต้องการแก้ไข");
                }
                if (tables.table_name && tables.table_name !== tableToUpdate.table_name) {
                    const existingTable = yield this.tablesModel.findOneByName(tables.table_name, tableToUpdate.branch_id);
                    if (existingTable) {
                        throw new Error("ชื่อโต๊ะนี้มีอยู่ในระบบแล้ว");
                    }
                }
                const effectiveBranchId = tableToUpdate.branch_id || branchId || tables.branch_id;
                const updatedTable = yield this.tablesModel.update(id, tables, effectiveBranchId);
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.tables.update, updatedTable);
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
                const existing = yield this.tablesModel.findOne(id, branchId);
                if (!existing)
                    throw new Error("Table not found");
                yield this.tablesModel.delete(id, branchId);
                const effectiveBranchId = existing.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.tables.delete, { id });
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.TablesService = TablesService;
