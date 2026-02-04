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
exports.getDbContext = getDbContext;
exports.getDbManager = getDbManager;
exports.getRepository = getRepository;
exports.runWithDbContext = runWithDbContext;
exports.runInTransaction = runInTransaction;
const node_async_hooks_1 = require("node:async_hooks");
const database_1 = require("./database");
const storage = new node_async_hooks_1.AsyncLocalStorage();
function getDbContext() {
    return storage.getStore();
}
function getDbManager() {
    var _a, _b;
    return (_b = (_a = storage.getStore()) === null || _a === void 0 ? void 0 : _a.manager) !== null && _b !== void 0 ? _b : database_1.AppDataSource.manager;
}
function getRepository(entity) {
    return getDbManager().getRepository(entity);
}
function setSessionGuc(queryRunner, key, value) {
    return __awaiter(this, void 0, void 0, function* () {
        yield queryRunner.query(`SELECT set_config($1, $2, false)`, [key, value]);
    });
}
function runWithDbContext(params, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const queryRunner = database_1.AppDataSource.createQueryRunner();
        yield queryRunner.connect();
        const branchValue = (_a = params.branchId) !== null && _a !== void 0 ? _a : "";
        const userIdValue = (_b = params.userId) !== null && _b !== void 0 ? _b : "";
        const roleValue = (_c = params.role) !== null && _c !== void 0 ? _c : "";
        const isAdminValue = params.isAdmin ? "true" : "false";
        yield setSessionGuc(queryRunner, "app.branch_id", branchValue);
        yield setSessionGuc(queryRunner, "app.user_id", userIdValue);
        yield setSessionGuc(queryRunner, "app.user_role", roleValue);
        yield setSessionGuc(queryRunner, "app.is_admin", isAdminValue);
        try {
            return yield storage.run({
                manager: queryRunner.manager,
                queryRunner,
                branchId: params.branchId,
                userId: params.userId,
                role: params.role,
                isAdmin: params.isAdmin,
            }, fn);
        }
        finally {
            try {
                yield setSessionGuc(queryRunner, "app.branch_id", "");
                yield setSessionGuc(queryRunner, "app.user_id", "");
                yield setSessionGuc(queryRunner, "app.user_role", "");
                yield setSessionGuc(queryRunner, "app.is_admin", "false");
            }
            catch (error) {
                console.warn("[DB] Failed to reset session context:", error);
            }
            try {
                yield queryRunner.release();
            }
            catch (error) {
                console.warn("[DB] Failed to release query runner:", error);
            }
        }
    });
}
function runInTransaction(fn) {
    return __awaiter(this, void 0, void 0, function* () {
        const store = storage.getStore();
        if (store) {
            return store.manager.transaction((txManager) => __awaiter(this, void 0, void 0, function* () {
                return storage.run(Object.assign(Object.assign({}, store), { manager: txManager }), () => fn(txManager));
            }));
        }
        return database_1.AppDataSource.transaction((txManager) => __awaiter(this, void 0, void 0, function* () { return fn(txManager); }));
    });
}
