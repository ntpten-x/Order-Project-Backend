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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeProfiledQuery = executeProfiledQuery;
exports.logProfileDuration = logProfileDuration;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const dbContext_1 = require("../database/dbContext");
const enabled = process.env.QUERY_PROFILE_ENABLED === "true";
const slowMs = Number(process.env.QUERY_PROFILE_SLOW_MS || 250);
const explainEnabled = process.env.QUERY_PROFILE_EXPLAIN === "true";
const logDir = process.env.QUERY_PROFILE_DIR || "query-plans";
const sampleRate = Number(process.env.QUERY_PROFILE_SAMPLE_RATE || 1);
function shouldSample() {
    if (!enabled)
        return false;
    if (sampleRate >= 1)
        return true;
    return Math.random() < Math.max(0, sampleRate);
}
function appendLogLine(line) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const targetDir = node_path_1.default.resolve(process.cwd(), logDir);
            yield (0, promises_1.mkdir)(targetDir, { recursive: true });
            const file = node_path_1.default.join(targetDir, "query-profile.log");
            yield (0, promises_1.appendFile)(file, `${new Date().toISOString()} ${line}\n`, "utf8");
        }
        catch (_a) {
            // non-blocking logging
        }
    });
}
function executeProfiledQuery(name_1, sql_1) {
    return __awaiter(this, arguments, void 0, function* (name, sql, params = []) {
        var _a;
        const start = process.hrtime.bigint();
        const result = yield (0, dbContext_1.getDbManager)().query(sql, params);
        const durationMs = Number(process.hrtime.bigint() - start) / 1000000;
        if (shouldSample()) {
            const level = durationMs >= slowMs ? "SLOW" : "OK";
            const msg = `[QUERY_PROFILE][${level}] ${name} ${durationMs.toFixed(1)}ms`;
            console.log(msg);
            yield appendLogLine(msg);
            if (explainEnabled && durationMs >= slowMs) {
                try {
                    const plan = yield (0, dbContext_1.getDbManager)().query(`EXPLAIN (FORMAT JSON) ${sql}`, params);
                    yield appendLogLine(`[QUERY_EXPLAIN] ${name} ${JSON.stringify((_a = plan === null || plan === void 0 ? void 0 : plan[0]) !== null && _a !== void 0 ? _a : plan)}`);
                }
                catch (error) {
                    yield appendLogLine(`[QUERY_EXPLAIN_ERROR] ${name} ${String(error)}`);
                }
            }
        }
        return result;
    });
}
function logProfileDuration(name, durationMs) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!shouldSample())
            return;
        const level = durationMs >= slowMs ? "SLOW" : "OK";
        const msg = `[QUERY_PROFILE][${level}] ${name} ${durationMs.toFixed(1)}ms`;
        console.log(msg);
        yield appendLogLine(msg);
    });
}
