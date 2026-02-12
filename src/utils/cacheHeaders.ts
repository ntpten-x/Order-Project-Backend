import { Response } from "express";

type PrivateSwrOptions = {
    maxAgeSec?: number;
    staleWhileRevalidateSec?: number;
    vary?: string;
};

export function setNoStoreHeaders(res: Response, vary: string = "Authorization, Cookie"): void {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Vary", vary);
}

export function setPrivateSwrHeaders(res: Response, options: PrivateSwrOptions = {}): void {
    const maxAgeSec = Number(options.maxAgeSec ?? process.env.POS_MASTER_CACHE_MAX_AGE_SEC ?? 60);
    const staleSec = Number(options.staleWhileRevalidateSec ?? process.env.POS_MASTER_CACHE_STALE_SEC ?? 60);
    const vary = options.vary ?? "Authorization, Cookie";

    res.setHeader("Cache-Control", `private, max-age=${maxAgeSec}, stale-while-revalidate=${staleSec}`);
    res.setHeader("Vary", vary);
}
