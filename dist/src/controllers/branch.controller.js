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
exports.BranchController = void 0;
const branch_service_1 = require("../services/branch.service");
class BranchController {
    constructor() {
        this.branchService = new branch_service_1.BranchService();
        this.getAll = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const branches = yield this.branchService.findAll();
                res.status(200).json(branches);
            }
            catch (error) {
                next(error);
            }
        });
        this.getOne = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const branch = yield this.branchService.findOne(id);
                if (!branch) {
                    res.status(404).json({ message: "Branch not found" });
                    return;
                }
                res.status(200).json(branch);
            }
            catch (error) {
                next(error);
            }
        });
        this.create = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const branch = yield this.branchService.create(req.body);
                res.status(201).json(branch);
            }
            catch (error) {
                next(error);
            }
        });
        this.update = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const branch = yield this.branchService.update(id, req.body);
                res.status(200).json(branch);
            }
            catch (error) {
                next(error);
            }
        });
        this.delete = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                yield this.branchService.delete(id);
                res.status(200).json({ message: "Branch deleted successfully" });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.BranchController = BranchController;
