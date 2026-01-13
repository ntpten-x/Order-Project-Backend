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
exports.PaymentsController = void 0;
class PaymentsController {
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
        this.findAll = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const payments = yield this.paymentsService.findAll();
                res.status(200).json(payments);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.findOne = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const payment = yield this.paymentsService.findOne(req.params.id);
                res.status(200).json(payment);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.create = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const payment = yield this.paymentsService.create(req.body);
                res.status(201).json(payment);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.update = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const payment = yield this.paymentsService.update(req.params.id, req.body);
                res.status(200).json(payment);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.delete = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.paymentsService.delete(req.params.id);
                res.status(200).json({ message: "ลบข้อมูลการชำระเงินสำเร็จ" });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.PaymentsController = PaymentsController;
