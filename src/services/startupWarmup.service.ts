import { AppDataSource } from "../database/database";
import { Branch } from "../entity/Branch";
import { ProductsModels } from "../models/pos/products.model";
import { CategoryModels } from "../models/pos/category.model";
import { runWithDbContext } from "../database/dbContext";
import { DashboardService } from "./pos/dashboard.service";
import { ShiftsService } from "./pos/shifts.service";

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return fallback;
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

function toSafeInt(value: number, fallback: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.trunc(value), min), max);
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return String(error);
}

class StartupWarmupService {
    private readonly dashboardService = new DashboardService();
    private readonly productsModel = new ProductsModels();
    private readonly categoryModel = new CategoryModels();
    private readonly shiftsService = new ShiftsService();
    private started = false;

    private readonly enabled = parseBooleanEnv(process.env.STARTUP_WARMUP_ENABLED, true);
    private readonly delayMs = toSafeInt(
        parseNumberEnv(process.env.STARTUP_WARMUP_DELAY_MS, 3_000),
        3_000,
        0,
        120_000
    );
    private readonly branchLimit = toSafeInt(
        parseNumberEnv(process.env.STARTUP_WARMUP_BRANCH_LIMIT, 3),
        3,
        1,
        20
    );
    private readonly taskTimeoutMs = toSafeInt(
        parseNumberEnv(process.env.STARTUP_WARMUP_TASK_TIMEOUT_MS, 4_500),
        4_500,
        500,
        60_000
    );
    private readonly productsEnabled = parseBooleanEnv(process.env.STARTUP_WARMUP_PRODUCTS_ENABLED, true);
    private readonly productsLimit = toSafeInt(
        parseNumberEnv(process.env.STARTUP_WARMUP_PRODUCTS_LIMIT, 20),
        20,
        1,
        200
    );
    private readonly productsAllEnabled = parseBooleanEnv(
        process.env.STARTUP_WARMUP_PRODUCTS_ALL_ENABLED,
        true
    );
    private readonly productsAllLimit = toSafeInt(
        parseNumberEnv(process.env.STARTUP_WARMUP_PRODUCTS_ALL_LIMIT, 50),
        50,
        1,
        200
    );
    private readonly productsActiveTotalEnabled = parseBooleanEnv(
        process.env.STARTUP_WARMUP_PRODUCTS_ACTIVE_TOTAL_ENABLED,
        true
    );
    private readonly categoriesEnabled = parseBooleanEnv(
        process.env.STARTUP_WARMUP_CATEGORIES_ENABLED,
        true
    );
    private readonly categoriesLimit = toSafeInt(
        parseNumberEnv(process.env.STARTUP_WARMUP_CATEGORIES_LIMIT, 50),
        50,
        1,
        200
    );
    private readonly shiftsEnabled = parseBooleanEnv(
        process.env.STARTUP_WARMUP_SHIFTS_ENABLED,
        true
    );
    private readonly shiftsHistoryLimit = toSafeInt(
        parseNumberEnv(process.env.STARTUP_WARMUP_SHIFTS_HISTORY_LIMIT, 20),
        20,
        1,
        200
    );
    private readonly dashboardTopLimit = toSafeInt(
        parseNumberEnv(process.env.STARTUP_WARMUP_DASHBOARD_TOP_LIMIT, 7),
        7,
        1,
        20
    );
    private readonly dashboardRecentLimit = toSafeInt(
        parseNumberEnv(process.env.STARTUP_WARMUP_DASHBOARD_RECENT_LIMIT, 8),
        8,
        1,
        30
    );

    schedule(): void {
        if (!this.enabled || this.started) {
            return;
        }

        this.started = true;
        const timer = setTimeout(() => {
            void this.run().catch((error) => {
                console.warn("[WARMUP] startup warmup aborted:", toErrorMessage(error));
            });
        }, this.delayMs);

        if (typeof timer.unref === "function") {
            timer.unref();
        }
    }

    private async run(): Promise<void> {
        if (!AppDataSource.isInitialized) {
            console.warn("[WARMUP] skipped because database is not initialized");
            return;
        }

        const startedAt = Date.now();
        const branches = await AppDataSource.getRepository(Branch).find({
            select: { id: true },
            where: { is_active: true },
            order: { create_date: "ASC" },
            take: this.branchLimit,
        });

        if (branches.length === 0) {
            console.log("[WARMUP] no active branches found");
            return;
        }

        let warmSuccessCount = 0;
        for (const branch of branches) {
            const ok = await this.warmBranch(branch.id);
            if (ok) {
                warmSuccessCount += 1;
            }
        }

        const durationMs = Date.now() - startedAt;
        console.log(
            `[WARMUP] completed in ${durationMs}ms (branches ${warmSuccessCount}/${branches.length})`
        );
    }

    private async warmBranch(branchId: string): Promise<boolean> {
        return runWithDbContext({ branchId, isAdmin: true }, async () => {
            const tasks: Array<{ name: string; run: () => Promise<unknown> }> = [
                {
                    name: "dashboard.overview",
                    run: () =>
                        this.dashboardService.getOverview(
                            undefined,
                            undefined,
                            branchId,
                            this.dashboardTopLimit,
                            this.dashboardRecentLimit
                        ),
                },
            ];

            if (this.productsEnabled) {
                tasks.push({
                    name: "products.list.active",
                    run: () =>
                        this.productsModel.findAll(
                            1,
                            this.productsLimit,
                            undefined,
                            undefined,
                            true,
                            branchId,
                            "old"
                        ),
                });
            }

            if (this.productsAllEnabled) {
                tasks.push({
                    name: "products.list.all",
                    run: () =>
                        this.productsModel.findAll(
                            1,
                            this.productsAllLimit,
                            undefined,
                            undefined,
                            undefined,
                            branchId,
                            "old"
                        ),
                });

                // Match the POS UI default page size to avoid cold-cache latency on first load.
                if (this.productsLimit !== this.productsAllLimit) {
                    tasks.push({
                        name: "products.list.all.ui",
                        run: () =>
                            this.productsModel.findAll(
                                1,
                                this.productsLimit,
                                undefined,
                                undefined,
                                undefined,
                                branchId,
                                "old"
                            ),
                    });
                }
            }

            if (this.productsActiveTotalEnabled) {
                tasks.push({
                    name: "products.count.active",
                    run: () =>
                        this.productsModel.countActive(undefined, branchId),
                });
            }

            if (this.categoriesEnabled) {
                tasks.push({
                    name: "categories.list.page1",
                    run: () =>
                        this.categoryModel.findAllPaginated(
                            1,
                            this.categoriesLimit,
                            undefined,
                            branchId,
                            "old"
                        ),
                });
            }

            if (this.shiftsEnabled) {
                tasks.push({
                    name: "shifts.current",
                    run: () => this.shiftsService.getCurrentShift(branchId),
                });
                tasks.push({
                    name: "shifts.history",
                    run: () =>
                        this.shiftsService.getShiftHistory({
                            branchId,
                            page: 1,
                            limit: this.shiftsHistoryLimit,
                            sortCreated: "old",
                        }),
                });
            }

            let hasError = false;
            for (const task of tasks) {
                try {
                    await this.runWithTimeout(task.run);
                } catch (error) {
                    hasError = true;
                    console.warn(
                        `[WARMUP] ${task.name} failed for branch=${branchId}: ${toErrorMessage(error)}`
                    );
                }
            }

            return !hasError;
        });
    }

    private async runWithTimeout<T>(run: () => Promise<T>): Promise<T> {
        let timeoutHandle: NodeJS.Timeout | undefined;
        try {
            return await Promise.race([
                run(),
                new Promise<T>((_, reject) => {
                    timeoutHandle = setTimeout(() => {
                        reject(new Error(`warmup timeout after ${this.taskTimeoutMs}ms`));
                    }, this.taskTimeoutMs);
                }),
            ]);
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }
}

export const startupWarmupService = new StartupWarmupService();
