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
exports.RolesController = void 0;
class RolesController {
    constructor(rolesService) {
        this.rolesService = rolesService;
        this.findAll = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const roles = yield this.rolesService.findAll();
                res.status(200).json(roles);
            }
            catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
        this.findOne = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const roles = yield this.rolesService.findOne(req.params.id);
                res.status(200).json(roles);
            }
            catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
        this.create = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const roles = yield this.rolesService.create(req.body);
                res.status(201).json(roles);
            }
            catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
        this.update = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const roles = yield this.rolesService.update(req.params.id, req.body);
                res.status(200).json(roles);
            }
            catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
        this.delete = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.rolesService.delete(req.params.id);
                res.status(204).send();
            }
            catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
    }
}
exports.RolesController = RolesController;
