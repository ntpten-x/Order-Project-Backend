import { ShopProfileModels } from "../../models/pos/shopProfile.model";
import { ShopProfile } from "../../entity/pos/ShopProfile";

export class ShopProfileService {
    constructor(private model: ShopProfileModels) { }

    async getProfile(branchId: string): Promise<ShopProfile> {
        let profile = await this.model.getProfile(branchId);
        if (!profile) {
            // Create default if not exists
            profile = await this.model.createOrUpdate(branchId, {
                shop_name: "POS Shop"
            });
        }
        return profile;
    }

    async updateProfile(branchId: string, data: Partial<ShopProfile>): Promise<ShopProfile> {
        return this.model.createOrUpdate(branchId, data);
    }
}
