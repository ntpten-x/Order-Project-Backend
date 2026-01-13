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
exports.OrdersDetailController = void 0;
class OrdersDetailController {
    constructor(ordersDetailService) {
        this.ordersDetailService = ordersDetailService;
        this.findAll = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const details = yield this.ordersDetailService.findAll();
                res.status(200).json(details);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.findOne = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const detail = yield this.ordersDetailService.findOne(req.params.id);
                res.status(200).json(detail);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.create = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const detail = yield this.ordersDetailService.create(req.body);
                res.status(201).json(detail);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.update = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const detail = yield this.ordersDetailService.update(req.params.id, req.body);
                res.status(200).json(detail);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.delete = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ordersDetailService.delete(req.params.id);
                res.status(200).json({ message: "ลบรายละเอียดเพิ่มเติมสำเร็จ" });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.OrdersDetailController = OrdersDetailController;
