import { Branch } from "../entity/Branch";
import { AppError } from "../utils/AppError";
import { SocketService } from "./socket.service";
import { RealtimeEvents } from "../utils/realtimeEvents";
import { getRepository } from "../database/dbContext";

export class BranchService {
    private get branchRepo() {
        return getRepository(Branch);
    }
    private socketService = SocketService.getInstance();

    async findAll(isActive: boolean = true): Promise<Branch[]> {
        return this.branchRepo.find({
            where: { is_active: isActive },
            order: { create_date: "ASC" }
        });
    }

    async findAllPaginated(
        page: number,
        limit: number,
        isActive?: boolean,
        q?: string
    ): Promise<{ data: Branch[]; total: number; page: number; limit: number; last_page: number }> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 200);

        const query = this.branchRepo.createQueryBuilder("branch")
            .orderBy("branch.create_date", "ASC")
            .skip((safePage - 1) * safeLimit)
            .take(safeLimit);

        if (typeof isActive === "boolean") {
            query.where("branch.is_active = :isActive", { isActive });
        }

        if (q?.trim()) {
            const keyword = `%${q.trim().toLowerCase()}%`;
            query.andWhere(
                "(LOWER(branch.branch_name) LIKE :q OR LOWER(branch.branch_code) LIKE :q OR LOWER(COALESCE(branch.address, '')) LIKE :q OR COALESCE(branch.phone, '') LIKE :phoneQ)",
                { q: keyword, phoneQ: `%${q.trim()}%` }
            );
        }

        const [data, total] = await query.getManyAndCount();
        const last_page = Math.max(Math.ceil(total / safeLimit), 1);
        return { data, total, page: safePage, limit: safeLimit, last_page };
    }

    async findOne(id: string): Promise<Branch | null> {
        return this.branchRepo.findOneBy({ id });
    }

    async create(data: Partial<Branch>): Promise<Branch> {
        const branch = this.branchRepo.create(data);
        const created = await this.branchRepo.save(branch);
        this.socketService.emitToRole("Admin", RealtimeEvents.branches.create, created);
        return created;
    }

    async update(id: string, data: Partial<Branch>): Promise<Branch> {
        const branch = await this.findOne(id);
        if (!branch) {
            throw new AppError("Branch not found", 404);
        }
        this.branchRepo.merge(branch, data);
        const updated = await this.branchRepo.save(branch);
        this.socketService.emitToRole("Admin", RealtimeEvents.branches.update, updated);
        return updated;
    }

    async delete(id: string): Promise<void> {
        const branch = await this.findOne(id);
        if (!branch) {
            throw new AppError("Branch not found", 404);
        }
        // Soft delete
        branch.is_active = false;
        await this.branchRepo.save(branch);
        this.socketService.emitToRole("Admin", RealtimeEvents.branches.delete, { id });
    }
}
