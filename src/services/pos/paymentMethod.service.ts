import { PaymentMethodModels } from "../../models/pos/paymentMethod.model";
import { SocketService } from "../socket.service";
import { PaymentMethod } from "../../entity/pos/PaymentMethod";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache";
import { getDbContext, getRepository } from "../../database/dbContext";
import { Payments } from "../../entity/pos/Payments";

export class PaymentMethodService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = "payment-method";
    private readonly CACHE_TTL = Number(process.env.POS_MASTER_CACHE_TTL_MS || 30_000);

    constructor(private paymentMethodModel: PaymentMethodModels) { }

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private getInvalidationPatterns(branchId?: string, id?: string): string[] {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;

        if (!effectiveBranchId) {
            return [`${this.CACHE_PREFIX}:`];
        }

        const scopes: Array<Array<string>> = [
            ["branch", effectiveBranchId],
            ["admin"],
            ["public"],
        ];
        const patterns: string[] = [];

        for (const scope of scopes) {
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "list"));
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "name"));
            if (id) {
                patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "single", id));
            }
        }

        return patterns;
    }

    private invalidatePaymentMethodCache(branchId?: string, id?: string): void {
        invalidateCache(this.getInvalidationPatterns(branchId, id));
    }

    private normalizeMutableFields(paymentMethod: Partial<PaymentMethod>): Partial<PaymentMethod> {
        const next = { ...paymentMethod };

        if (next.payment_method_name !== undefined) {
            const value = next.payment_method_name.trim();
            if (!value) {
                throw AppError.badRequest("Payment method name is required");
            }
            next.payment_method_name = value;
        }

        if (next.display_name !== undefined) {
            const value = next.display_name.trim();
            if (!value) {
                throw AppError.badRequest("Payment method display name is required");
            }
            next.display_name = value;
        }

        return next;
    }

    async findAll(
        page: number,
        limit: number,
        q?: string,
        status?: "active" | "inactive",
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: PaymentMethod[]; total: number; page: number; last_page: number }> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(
            this.CACHE_PREFIX,
            ...scope,
            "list",
            page,
            limit,
            sortCreated,
            (q || "").trim().toLowerCase(),
            status || "all"
        );

        return withCache(
            key,
            () => this.paymentMethodModel.findAll(page, limit, q, status, branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<PaymentMethod | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => this.paymentMethodModel.findOne(id, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOneByName(payment_method_name: string, branchId?: string): Promise<PaymentMethod | null> {
        const scope = this.getCacheScopeParts(branchId);
        const normalizedName = payment_method_name.trim().toLowerCase();
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "name", normalizedName);

        return withCache(
            key,
            () => this.paymentMethodModel.findOneByName(payment_method_name, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async create(paymentMethod: PaymentMethod, branchId?: string): Promise<PaymentMethod> {
        const normalizedPaymentMethod = this.normalizeMutableFields(paymentMethod) as PaymentMethod;
        const effectiveBranchId = branchId || normalizedPaymentMethod.branch_id;
        if (effectiveBranchId) {
            normalizedPaymentMethod.branch_id = effectiveBranchId;
        }

        const existingPaymentMethod = await this.paymentMethodModel.findOneByName(
            normalizedPaymentMethod.payment_method_name,
            effectiveBranchId
        );
        if (existingPaymentMethod) {
            throw AppError.conflict("Payment method name already exists");
        }

        const createdPaymentMethod = await this.paymentMethodModel.create(normalizedPaymentMethod);
        this.invalidatePaymentMethodCache(effectiveBranchId, createdPaymentMethod.id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.paymentMethods.create, createdPaymentMethod);
        }
        return createdPaymentMethod;
    }

    async update(id: string, paymentMethod: PaymentMethod, branchId?: string): Promise<PaymentMethod> {
        const effectiveBranchId = branchId || paymentMethod.branch_id;
        const paymentMethodToUpdate = await this.paymentMethodModel.findOne(id, effectiveBranchId);
        if (!paymentMethodToUpdate) {
            throw AppError.notFound("Payment method");
        }

        const normalizedPaymentMethod = this.normalizeMutableFields(paymentMethod) as PaymentMethod;
        const resolvedBranchId = effectiveBranchId || paymentMethodToUpdate.branch_id;
        if (resolvedBranchId) {
            normalizedPaymentMethod.branch_id = resolvedBranchId;
        }

        const normalizedIncomingName = normalizedPaymentMethod.payment_method_name?.trim().toLowerCase();
        const normalizedCurrentName = paymentMethodToUpdate.payment_method_name?.trim().toLowerCase();
        if (normalizedIncomingName && normalizedIncomingName !== normalizedCurrentName) {
            const existingPaymentMethod = await this.paymentMethodModel.findOneByName(
                normalizedPaymentMethod.payment_method_name,
                resolvedBranchId
            );
            if (existingPaymentMethod && existingPaymentMethod.id !== id) {
                throw AppError.conflict("Payment method name already exists");
            }
        }

        const updatedPaymentMethod = await this.paymentMethodModel.update(id, normalizedPaymentMethod, resolvedBranchId);
        this.invalidatePaymentMethodCache(resolvedBranchId, id);
        if (resolvedBranchId) {
            this.socketService.emitToBranch(resolvedBranchId, RealtimeEvents.paymentMethods.update, updatedPaymentMethod);
        }
        return updatedPaymentMethod;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.paymentMethodModel.findOne(id, branchId);
        if (!existing) {
            throw AppError.notFound("Payment method");
        }

        const effectiveBranchId = branchId || existing.branch_id;
        const paymentCount = await getRepository(Payments).count({
            where: effectiveBranchId
                ? ({ payment_method_id: id, branch_id: effectiveBranchId } as any)
                : ({ payment_method_id: id } as any),
        });
        if (paymentCount > 0) {
            throw AppError.conflict("Payment method cannot be deleted because it is referenced by payments");
        }

        await this.paymentMethodModel.delete(id, effectiveBranchId);
        this.invalidatePaymentMethodCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.paymentMethods.delete, { id });
        }
    }
}
