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
exports.PaymentMethodController = void 0;
const branch_middleware_1 = require("../../middleware/branch.middleware");
class PaymentMethodController {
    constructor(paymentMethodService) {
        this.paymentMethodService = paymentMethodService;
        this.findAll = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const page = parseInt(req.query.page) || 1;
                const rawLimit = parseInt(req.query.limit);
                const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
                const q = req.query.q || undefined;
                const branchId = (0, branch_middleware_1.getBranchId)(req);
                const paymentMethods = yield this.paymentMethodService.findAll(page, limit, q, branchId);
                res.status(200).json(paymentMethods);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.findOne = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const branchId = (0, branch_middleware_1.getBranchId)(req);
                const paymentMethod = yield this.paymentMethodService.findOne(req.params.id, branchId);
                res.status(200).json(paymentMethod);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.findByName = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const branchId = (0, branch_middleware_1.getBranchId)(req);
                const paymentMethod = yield this.paymentMethodService.findOneByName(req.params.name, branchId);
                res.status(200).json(paymentMethod);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.create = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const branchId = (0, branch_middleware_1.getBranchId)(req);
                if (branchId && !req.body.branch_id) {
                    req.body.branch_id = branchId;
                }
                const paymentMethod = yield this.paymentMethodService.create(req.body);
                res.status(201).json(paymentMethod);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.update = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const paymentMethod = yield this.paymentMethodService.update(req.params.id, req.body);
                res.status(200).json(paymentMethod);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.delete = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.paymentMethodService.delete(req.params.id);
                res.status(200).json({ message: "ลบข้อมูลวิธีการชำระเงินสำเร็จ" });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.PaymentMethodController = PaymentMethodController;
