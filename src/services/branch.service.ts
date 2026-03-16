import { Branch } from "../entity/Branch";
import { Users } from "../entity/Users";
import { AppError } from "../utils/AppError";
import { SocketService } from "./socket.service";
import { RealtimeEvents } from "../utils/realtimeEvents";
import { getRepository } from "../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../utils/sortCreated";

export class BranchService {
    private static readonly BRANCH_CODE_PATTERN = /^[A-Za-z0-9]+$/;

    private get branchRepo() {
        return getRepository(Branch);
    }

    private get usersRepo() {
        return getRepository(Users);
    }

    private socketService = SocketService.getInstance();

    private normalizeBranchName(value: unknown): string {
        return String(value || "").trim();
    }

    private normalizeBranchCode(value: unknown): string {
        return String(value || "").trim().toUpperCase();
    }

    private normalizeOptionalText(value: unknown): string | undefined {
        const normalized = String(value || "").trim();
        return normalized || undefined;
    }

    private async ensureUniqueBranchCode(branchCode: string, excludeId?: string): Promise<void> {
        const existing = await this.branchRepo
            .createQueryBuilder("branch")
            .where("UPPER(branch.branch_code) = :branchCode", { branchCode })
            .getOne();
        if (existing && existing.id !== excludeId) {
            throw AppError.conflict(`Branch code "${branchCode}" is already in use`);
        }
    }

    private async assertBranchCanBeInactive(branch: Branch): Promise<void> {
        if (!branch.is_active) {
            return;
        }

        const activeBranchCount = await this.branchRepo.countBy({ is_active: true });
        if (activeBranchCount <= 1) {
            throw AppError.badRequest("Cannot deactivate the last active branch");
        }

        const assignedUsers = await this.usersRepo.countBy({ branch_id: branch.id });
        if (assignedUsers > 0) {
            throw AppError.conflict("Cannot deactivate a branch that still has assigned users");
        }
    }

    async findAll(isActive: boolean = true): Promise<Branch[]> {
        return this.branchRepo.find({
            where: { is_active: isActive },
            order: { create_date: "ASC", branch_name: "ASC" }
        });
    }

    async findAllPaginated(
        page: number,
        limit: number,
        isActive?: boolean,
        q?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Branch[]; total: number; page: number; limit: number; last_page: number }> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 200);

        const query = this.branchRepo.createQueryBuilder("branch")
            .orderBy("branch.create_date", createdSortToOrder(sortCreated))
            .addOrderBy("branch.branch_name", "ASC")
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
        const branchName = this.normalizeBranchName(data.branch_name);
        const branchCode = this.normalizeBranchCode(data.branch_code);
        if (!branchName) {
            throw AppError.badRequest("Branch name is required");
        }
        if (!branchCode) {
            throw AppError.badRequest("Branch code is required");
        }
        if (!BranchService.BRANCH_CODE_PATTERN.test(branchCode)) {
            throw AppError.badRequest("Branch code must contain only letters and numbers");
        }

        await this.ensureUniqueBranchCode(branchCode);

        const branch = this.branchRepo.create({
            branch_name: branchName,
            branch_code: branchCode,
            address: this.normalizeOptionalText(data.address),
            phone: this.normalizeOptionalText(data.phone),
            tax_id: this.normalizeOptionalText(data.tax_id),
            is_active: data.is_active !== false,
        });
        const created = await this.branchRepo.save(branch);
        this.socketService.emitToRole("Admin", RealtimeEvents.branches.create, created);
        return created;
    }

    async update(id: string, data: Partial<Branch>): Promise<Branch> {
        const branch = await this.findOne(id);
        if (!branch) {
            throw new AppError("Branch not found", 404);
        }

        const nextBranchName = "branch_name" in data ? this.normalizeBranchName(data.branch_name) : branch.branch_name;
        const nextBranchCode = "branch_code" in data ? this.normalizeBranchCode(data.branch_code) : branch.branch_code;

        if (!nextBranchName) {
            throw AppError.badRequest("Branch name is required");
        }
        if (!nextBranchCode) {
            throw AppError.badRequest("Branch code is required");
        }
        if (!BranchService.BRANCH_CODE_PATTERN.test(nextBranchCode)) {
            throw AppError.badRequest("Branch code must contain only letters and numbers");
        }

        if (nextBranchCode !== branch.branch_code) {
            await this.ensureUniqueBranchCode(nextBranchCode, id);
        }

        const nextIsActive = data.is_active ?? branch.is_active;
        if (!nextIsActive) {
            await this.assertBranchCanBeInactive(branch);
        }

        this.branchRepo.merge(branch, {
            branch_name: nextBranchName,
            branch_code: nextBranchCode,
            address: "address" in data ? this.normalizeOptionalText(data.address) : branch.address,
            phone: "phone" in data ? this.normalizeOptionalText(data.phone) : branch.phone,
            tax_id: "tax_id" in data ? this.normalizeOptionalText(data.tax_id) : branch.tax_id,
            is_active: nextIsActive,
        });
        const updated = await this.branchRepo.save(branch);
        this.socketService.emitToRole("Admin", RealtimeEvents.branches.update, updated);
        return updated;
    }

    async delete(id: string): Promise<void> {
        const branch = await this.findOne(id);
        if (!branch) {
            throw new AppError("Branch not found", 404);
        }

        await this.assertBranchCanBeInactive(branch);

        // Soft delete
        branch.is_active = false;
        await this.branchRepo.save(branch);
        this.socketService.emitToRole("Admin", RealtimeEvents.branches.delete, { id });
    }
}
