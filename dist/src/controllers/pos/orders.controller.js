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
exports.OrdersController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
class OrdersController {
    constructor(ordersService) {
        this.ordersService = ordersService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const limitRaw = parseInt(req.query.limit) || 50;
            const limit = Math.min(Math.max(limitRaw, 1), 200); // cap to prevent huge payloads
            const statuses = req.query.status ? req.query.status.split(',') : undefined;
            const type = req.query.type;
            const query = req.query.q;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            const result = yield this.ordersService.findAll(page, limit, statuses, type, query, branchId);
            res.status(200).json(result);
        }));
        this.findSummary = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const limitRaw = parseInt(req.query.limit) || 50;
            const limit = Math.min(Math.max(limitRaw, 1), 200);
            const statuses = req.query.status ? req.query.status.split(',') : undefined;
            const type = req.query.type;
            const query = req.query.q;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            const result = yield this.ordersService.findAllSummary(page, limit, statuses, type, query, branchId);
            res.status(200).json(result);
        }));
        this.getStats = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            const stats = yield this.ordersService.getStats(branchId);
            res.status(200).json(stats);
        }));
        this.findAllItems = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const status = req.query.status;
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const limitRaw = parseInt(req.query.limit) || 100;
            const limit = Math.min(Math.max(limitRaw, 1), 200); // cap to prevent huge payloads
            const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
            const result = yield this.ordersService.findAllItems(status, page, limit, branchId);
            res.status(200).json(result);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const order = yield this.ordersService.findOne(req.params.id);
            if (!order) {
                throw new AppError_1.AppError("ไม่พบข้อมูลออเดอร์", 404);
            }
            res.status(200).json(order);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = req.user;
            if ((user === null || user === void 0 ? void 0 : user.id) && !req.body.created_by_id) {
                req.body.created_by_id = user.id;
            }
            if ((user === null || user === void 0 ? void 0 : user.branch_id) && !req.body.branch_id) {
                req.body.branch_id = user.branch_id;
            }
            // Check if input has items, if so use createFullOrder
            if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
                const order = yield this.ordersService.createFullOrder(req.body);
                res.status(201).json(order);
            }
            else {
                const order = yield this.ordersService.create(req.body);
                res.status(201).json(order);
            }
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const order = yield this.ordersService.update(req.params.id, req.body);
            res.status(200).json(order);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            yield this.ordersService.delete(req.params.id);
            res.status(200).json({ message: "ลบข้อมูลออเดอร์สำเร็จ" });
        }));
        this.updateItemStatus = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { status } = req.body;
            if (!status) {
                throw new AppError_1.AppError("กรุณาระบุสถานะ", 400);
            }
            yield this.ordersService.updateItemStatus(req.params.id, status);
            res.status(200).json({ message: "อัปเดตสถานะสำเร็จ" });
        }));
        this.addItem = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const order = yield this.ordersService.addItem(req.params.id, req.body);
            res.status(201).json(order);
        }));
        this.updateItem = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const order = yield this.ordersService.updateItemDetails(req.params.itemId, req.body);
            res.status(200).json(order);
        }));
        this.deleteItem = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const order = yield this.ordersService.deleteItem(req.params.itemId);
            res.status(200).json(order);
        }));
    }
}
exports.OrdersController = OrdersController;
