import { randomBytes } from "crypto";
import { getRepository } from "../../database/dbContext";
import { ShopProfile } from "../../entity/pos/ShopProfile";
import { ShopProfileModels } from "../../models/pos/shopProfile.model";
import { AppError } from "../../utils/AppError";

const TAKEAWAY_QR_TOKEN_BYTES = Math.max(16, Number(process.env.TAKEAWAY_QR_TOKEN_BYTES || 24));
const TAKEAWAY_QR_TOKEN_EXPIRE_DAYS = Number(process.env.TAKEAWAY_QR_TOKEN_EXPIRE_DAYS || 365);
const TAKEAWAY_QR_TOKEN_PREFIX = "tw_";

export type TakeawayQrInfo = {
    token: string;
    customer_path: string;
    qr_code_expires_at: Date | null;
    shop_name: string | null;
};

export class TakeawayQrService {
    constructor(private shopProfileModel: ShopProfileModels = new ShopProfileModels()) {}

    private isExpired(expiresAt?: Date | string | null): boolean {
        if (!expiresAt) return false;
        const timestamp = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
        return !Number.isFinite(timestamp) || timestamp <= Date.now();
    }

    private buildToken(): string {
        return `${TAKEAWAY_QR_TOKEN_PREFIX}${randomBytes(TAKEAWAY_QR_TOKEN_BYTES).toString("base64url")}`;
    }

    private resolveExpiryDate(): Date | null {
        if (!Number.isFinite(TAKEAWAY_QR_TOKEN_EXPIRE_DAYS) || TAKEAWAY_QR_TOKEN_EXPIRE_DAYS <= 0) {
            return null;
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + TAKEAWAY_QR_TOKEN_EXPIRE_DAYS);
        return expiresAt;
    }

    private async generateUniqueToken(): Promise<string> {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const token = this.buildToken();
            const existing = await getRepository(ShopProfile).findOne({
                where: { takeaway_qr_token: token },
                select: ["id"],
            });

            if (!existing) {
                return token;
            }
        }

        throw AppError.internal("Unable to generate unique takeaway QR token");
    }

    private async getOrCreateProfile(branchId: string): Promise<ShopProfile> {
        let profile = await this.shopProfileModel.getProfile(branchId);
        if (!profile) {
            profile = await this.shopProfileModel.createOrUpdate(branchId, {
                shop_name: "POS Shop",
            });
        }
        return profile;
    }

    private async ensureActiveProfile(branchId: string): Promise<ShopProfile> {
        const profile = await this.getOrCreateProfile(branchId);
        if (profile.takeaway_qr_token && !this.isExpired(profile.takeaway_qr_expires_at)) {
            return profile;
        }

        return this.shopProfileModel.createOrUpdate(branchId, {
            takeaway_qr_token: await this.generateUniqueToken(),
            takeaway_qr_expires_at: this.resolveExpiryDate(),
        });
    }

    async getQrInfo(branchId: string): Promise<TakeawayQrInfo> {
        const profile = await this.ensureActiveProfile(branchId);
        if (!profile.takeaway_qr_token) {
            throw AppError.internal("Takeaway QR token is missing");
        }

        return {
            token: profile.takeaway_qr_token,
            customer_path: `/order/takeaway/${profile.takeaway_qr_token}`,
            qr_code_expires_at: profile.takeaway_qr_expires_at ?? null,
            shop_name: profile.shop_name || null,
        };
    }
}
