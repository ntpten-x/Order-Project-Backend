import { ShopProfileModels } from "../../models/pos/shopProfile.model";
import { ShopProfile } from "../../entity/pos/ShopProfile";
import { SocketService } from "../socket.service";
import { RealtimeEvents } from "../../utils/realtimeEvents";

export class ShopProfileService {
    private socketService = SocketService.getInstance();

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
        const updated = await this.model.createOrUpdate(branchId, data);
        if (branchId) {
            this.socketService.emitToBranch(branchId, RealtimeEvents.shopProfile.update, updated);
        }
        return updated;
    }
}
