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
exports.TablesController = void 0;
class TablesController {
    constructor(tablesService) {
        this.tablesService = tablesService;
        this.findAll = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const page = parseInt(req.query.page) || 1;
                const rawLimit = parseInt(req.query.limit);
                const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
                const q = req.query.q || undefined;
                const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
                const tables = yield this.tablesService.findAll(page, limit, q, branchId);
                res.status(200).json(tables);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.findOne = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const table = yield this.tablesService.findOne(req.params.id);
                res.status(200).json(table);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.findByName = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const table = yield this.tablesService.findOneByName(req.params.name);
                res.status(200).json(table);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.create = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const branchId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id;
                if (branchId && !req.body.branch_id) {
                    req.body.branch_id = branchId;
                }
                const table = yield this.tablesService.create(req.body);
                res.status(201).json(table);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.update = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const table = yield this.tablesService.update(req.params.id, req.body);
                res.status(200).json(table);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        this.delete = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.tablesService.delete(req.params.id);
                res.status(200).json({ message: "ลบข้อมูลโต๊ะสำเร็จ" });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}
exports.TablesController = TablesController;
