import { AppDataSource } from "../../database/database";
import { ShopProfile } from "../../entity/pos/ShopProfile";

export class ShopProfileModels {
    private repo = AppDataSource.getRepository(ShopProfile);

    // Get the first profile (assuming single shop for now)
    async getProfile(): Promise<ShopProfile | null> {
        return this.repo.findOne({ where: {} });
    }

    async createOrUpdate(data: Partial<ShopProfile>): Promise<ShopProfile> {
        const existing = await this.getProfile();
        if (existing) {
            await this.repo.update(existing.id, data);
            return this.repo.findOneBy({ id: existing.id }) as Promise<ShopProfile>;
        }
        const newProfile = this.repo.create(data);
        return this.repo.save(newProfile);
    }
}
