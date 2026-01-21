import { ShopProfileModels } from "../../models/pos/shopProfile.model";
import { ShopProfile } from "../../entity/pos/ShopProfile";

export class ShopProfileService {
    constructor(private model: ShopProfileModels) { }

    async getProfile(): Promise<ShopProfile> {
        let profile = await this.model.getProfile();
        if (!profile) {
            // Create default if not exists
            profile = await this.model.createOrUpdate({
                shop_name: "POS Shop"
            });
        }
        return profile;
    }

    async updateProfile(data: Partial<ShopProfile>): Promise<ShopProfile> {
        return this.model.createOrUpdate(data);
    }
}
