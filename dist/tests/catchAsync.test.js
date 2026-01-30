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
const vitest_1 = require("vitest");
const catchAsync_1 = require("../src/utils/catchAsync");
(0, vitest_1.describe)("catchAsync", () => {
    (0, vitest_1.it)("forwards rejected promise to next", () => __awaiter(void 0, void 0, void 0, function* () {
        const error = new Error("boom");
        const fn = (0, catchAsync_1.catchAsync)(() => __awaiter(void 0, void 0, void 0, function* () {
            throw error;
        }));
        const next = vitest_1.vi.fn();
        fn({}, {}, next);
        yield Promise.resolve(); // allow promise to settle
        (0, vitest_1.expect)(next).toHaveBeenCalledWith(error);
    }));
});
