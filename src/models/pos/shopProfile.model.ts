import { ShopProfile } from "../../entity/pos/ShopProfile";
import { getRepository } from "../../database/dbContext";

export class ShopProfileModels {
    async getProfile(branchId: string): Promise<ShopProfile | null> {
        return getRepository(ShopProfile).findOne({ where: { branch_id: branchId } as any });
    }

    async createOrUpdate(branchId: string, data: Partial<ShopProfile>): Promise<ShopProfile> {
        const repo = getRepository(ShopProfile);
        const existing = await this.getProfile(branchId);
        if (existing) {
            await repo.update(existing.id, { ...data, branch_id: branchId });
            return repo.findOneBy({ id: existing.id }) as Promise<ShopProfile>;
        }
        const newProfile = repo.create({ ...data, branch_id: branchId });
        return repo.save(newProfile);
    }
}
