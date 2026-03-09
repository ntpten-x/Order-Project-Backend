import { ShopProfileModels } from "../../models/pos/shopProfile.model";
import { ShopProfile } from "../../entity/pos/ShopProfile";
import { SocketService } from "../socket.service";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache";
import { getDbContext } from "../../database/dbContext";

export class ShopProfileService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = "shop-profile";
    private readonly CACHE_TTL = Number(process.env.POS_MASTER_CACHE_TTL_MS || 30_000);

    constructor(private model: ShopProfileModels) { }

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private invalidateProfileCache(branchId?: string): void {
        if (!branchId) {
            invalidateCache([`${this.CACHE_PREFIX}:`]);
            return;
        }

        invalidateCache([
            cacheKey(this.CACHE_PREFIX, "branch", branchId, "single"),
            cacheKey(this.CACHE_PREFIX, "admin", "single"),
            cacheKey(this.CACHE_PREFIX, "public", "single"),
        ]);
    }

    async getProfile(branchId: string): Promise<ShopProfile> {
        const key = cacheKey(this.CACHE_PREFIX, ...this.getCacheScopeParts(branchId), "single");

        return withCache(
            key,
            async () => {
                let profile = await this.model.getProfile(branchId);
                if (!profile) {
                    profile = await this.model.createOrUpdate(branchId, {
                        shop_name: "POS Shop",
                    });
                }
                return profile;
            },
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async updateProfile(branchId: string, data: Partial<ShopProfile>): Promise<ShopProfile> {
        const nextData: Partial<ShopProfile> = {
            ...data,
            shop_name: data.shop_name?.trim() || "POS Shop",
            address: data.address?.trim() || undefined,
            phone: data.phone?.trim() || undefined,
            promptpay_name: data.promptpay_name?.trim() || undefined,
            promptpay_number: data.promptpay_number?.replace(/\D/g, "") || undefined,
        };

        const updated = await this.model.createOrUpdate(branchId, nextData);
        this.invalidateProfileCache(branchId);
        if (branchId) {
            this.socketService.emitToBranch(branchId, RealtimeEvents.shopProfile.update, updated);
        }
        return updated;
    }
}
