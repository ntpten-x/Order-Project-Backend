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
exports.IngredientsService = void 0;
const socket_service_1 = require("./socket.service");
class IngredientsService {
    constructor(ingredientsModel) {
        this.ingredientsModel = ingredientsModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsModel.findAll(filters);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(ingredient_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsModel.findOneByName(ingredient_name);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(ingredients) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // @ts-ignore
                const savedIngredients = yield this.ingredientsModel.create(ingredients);
                const createdIngredients = yield this.ingredientsModel.findOne(savedIngredients.id);
                if (createdIngredients) {
                    this.socketService.emit('ingredients:create', createdIngredients);
                    return createdIngredients;
                }
                return savedIngredients;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, ingredients) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ingredientsModel.update(id, ingredients);
                const updatedIngredients = yield this.ingredientsModel.findOne(id);
                if (updatedIngredients) {
                    this.socketService.emit('ingredients:update', updatedIngredients);
                    return updatedIngredients;
                }
                throw new Error("พบข้อผิดพลาดในการอัปเดตวัตถุดิบ");
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ingredientsModel.delete(id);
                this.socketService.emit('ingredients:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.IngredientsService = IngredientsService;
