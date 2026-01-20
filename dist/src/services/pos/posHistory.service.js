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
exports.PosHistoryService = void 0;
class PosHistoryService {
    constructor(posHistoryModel) {
        this.posHistoryModel = posHistoryModel;
    }
    findAll(page, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.posHistoryModel.findAll(page, limit);
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.posHistoryModel.findOne(id);
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Here you might add logic to format data or validate before saving
            return this.posHistoryModel.create(data);
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.posHistoryModel.update(id, data);
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.posHistoryModel.delete(id);
        });
    }
}
exports.PosHistoryService = PosHistoryService;
