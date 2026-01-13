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
exports.DiscountsController = void 0;
class DiscountsController {
    constructor(discountsService) {
        this.discountsService = discountsService;
        this.findAll = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const discounts = yield this.discountsService.findAll();
                res.status(200).json(discounts);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.findOne = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const discount = yield this.discountsService.findOne(req.params.id);
                res.status(200).json(discount);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.create = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const discount = yield this.discountsService.create(req.body);
                res.status(201).json(discount);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.update = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const discount = yield this.discountsService.update(req.params.id, req.body);
                res.status(200).json(discount);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.delete = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.discountsService.delete(req.params.id);
                res.status(200).json({ message: "ลบข้อมูลส่วนลดสำเร็จ" });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.DiscountsController = DiscountsController;
