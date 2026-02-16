"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setNoStoreHeaders = setNoStoreHeaders;
exports.setPrivateSwrHeaders = setPrivateSwrHeaders;
function setNoStoreHeaders(res, vary = "Authorization, Cookie") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Vary", vary);
}
function setPrivateSwrHeaders(res, options = {}) {
    var _a, _b, _c, _d, _e;
    const maxAgeSec = Number((_b = (_a = options.maxAgeSec) !== null && _a !== void 0 ? _a : process.env.POS_MASTER_CACHE_MAX_AGE_SEC) !== null && _b !== void 0 ? _b : 60);
    const staleSec = Number((_d = (_c = options.staleWhileRevalidateSec) !== null && _c !== void 0 ? _c : process.env.POS_MASTER_CACHE_STALE_SEC) !== null && _d !== void 0 ? _d : 60);
    const vary = (_e = options.vary) !== null && _e !== void 0 ? _e : "Authorization, Cookie";
    res.setHeader("Cache-Control", `private, max-age=${maxAgeSec}, stale-while-revalidate=${staleSec}`);
    res.setHeader("Vary", vary);
}
