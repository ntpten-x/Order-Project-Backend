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
exports.IngredientsUnitService = void 0;
const socket_service_1 = require("./socket.service");
class IngredientsUnitService {
    constructor(ingredientsUnitModel) {
        this.ingredientsUnitModel = ingredientsUnitModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsUnitModel.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsUnitModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByUnitName(unit_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsUnitModel.findOneByUnitName(unit_name);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(ingredientsUnit) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // @ts-ignore - model returns {id} essentially
                const savedIngredientsUnit = yield this.ingredientsUnitModel.create(ingredientsUnit);
                const createdIngredientsUnit = yield this.ingredientsUnitModel.findOne(savedIngredientsUnit.id);
                if (createdIngredientsUnit) {
                    this.socketService.emit('ingredientsUnit:create', createdIngredientsUnit);
                    return createdIngredientsUnit;
                }
                return savedIngredientsUnit;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, ingredientsUnit) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ingredientsUnitModel.update(id, ingredientsUnit);
                const updatedIngredientsUnit = yield this.ingredientsUnitModel.findOne(id);
                if (updatedIngredientsUnit) {
                    this.socketService.emit('ingredientsUnit:update', updatedIngredientsUnit);
                    return updatedIngredientsUnit;
                }
                throw new Error("พบข้อผิดพลาดในการอัปเดตหน่วยนับวัตถุดิบ");
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ingredientsUnitModel.delete(id);
                this.socketService.emit('ingredientsUnit:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.IngredientsUnitService = IngredientsUnitService;
