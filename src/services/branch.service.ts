import { AppDataSource } from "../database/database";
import { Branch } from "../entity/Branch";
import { AppError } from "../utils/AppError";
import { SocketService } from "./socket.service";

export class BranchService {
    private branchRepo = AppDataSource.getRepository(Branch);
    private socketService = SocketService.getInstance();

    async findAll(isActive: boolean = true): Promise<Branch[]> {
        return this.branchRepo.find({
            where: { is_active: isActive },
            order: { create_date: "ASC" }
        });
    }

    async findOne(id: string): Promise<Branch | null> {
        return this.branchRepo.findOneBy({ id });
    }

    async create(data: Partial<Branch>): Promise<Branch> {
        const branch = this.branchRepo.create(data);
        const created = await this.branchRepo.save(branch);
        this.socketService.emit("branches:create", created);
        return created;
    }

    async update(id: string, data: Partial<Branch>): Promise<Branch> {
        const branch = await this.findOne(id);
        if (!branch) {
            throw new AppError("Branch not found", 404);
        }
        this.branchRepo.merge(branch, data);
        const updated = await this.branchRepo.save(branch);
        this.socketService.emit("branches:update", updated);
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
        this.socketService.emit("branches:delete", { id });
    }
}
