"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionsService = void 0;
const database_1 = require("../../database/database");
const Promotions_1 = require("../../entity/pos/Promotions");
const Products_1 = require("../../entity/pos/Products");
const Category_1 = require("../../entity/pos/Category");
const socket_service_1 = require("../socket.service");
const AppError_1 = require("../../utils/AppError");
class PromotionsService {
    constructor() {
        this.promotionsRepository = database_1.AppDataSource.getRepository(Promotions_1.Promotions);
        this.productsRepository = database_1.AppDataSource.getRepository(Products_1.Products);
        this.categoryRepository = database_1.AppDataSource.getRepository(Category_1.Category);
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    /**
     * Check if promotion code is valid and applicable
     */
    validatePromotionCode(code, orderItems, totalAmount, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const promotion = yield this.promotionsRepository.findOne({
                where: {
                    promotion_code: code,
                    is_active: true,
                    branch_id: branchId || undefined,
                },
            });
            if (!promotion) {
                return {
                    eligible: false,
                    discountAmount: 0,
                    message: "รหัสโปรโมชันไม่ถูกต้องหรือหมดอายุ",
                };
            }
            // Check date range
            const now = new Date();
            if (promotion.start_date && now < promotion.start_date) {
                return {
                    eligible: false,
                    discountAmount: 0,
                    message: "โปรโมชันยังไม่เริ่มต้น",
                };
            }
            if (promotion.end_date && now > promotion.end_date) {
                return {
                    eligible: false,
                    discountAmount: 0,
                    message: "โปรโมชันหมดอายุแล้ว",
                };
            }
            // Check usage limit
            if (promotion.usage_limit && promotion.usage_count && promotion.usage_count >= promotion.usage_limit) {
                return {
                    eligible: false,
                    discountAmount: 0,
                    message: "โปรโมชันถูกใช้ครบจำนวนแล้ว",
                };
            }
            // Check minimum purchase
            if (promotion.minimum_purchase && totalAmount < promotion.minimum_purchase) {
                return {
                    eligible: false,
                    discountAmount: 0,
                    message: `ยอดซื้อขั้นต่ำ ${promotion.minimum_purchase} บาท`,
                };
            }
            // Check conditions
            const conditionMet = yield this.checkCondition(promotion, orderItems, totalAmount);
            if (!conditionMet) {
                return {
                    eligible: false,
                    discountAmount: 0,
                    message: "ไม่ตรงตามเงื่อนไขโปรโมชัน",
                };
            }
            // Calculate discount
            const discountAmount = this.calculateDiscount(promotion, orderItems, totalAmount);
            return {
                eligible: true,
                discountAmount,
            };
        });
    }
    /**
     * Check if order meets promotion conditions
     */
    checkCondition(promotion, orderItems, totalAmount) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (promotion.condition_type) {
                case Promotions_1.PromotionCondition.AllProducts:
                    return true;
                case Promotions_1.PromotionCondition.MinimumAmount:
                    return totalAmount >= (promotion.minimum_purchase || 0);
                case Promotions_1.PromotionCondition.SpecificCategory:
                    if (!promotion.condition_value)
                        return false;
                    const categoryIds = JSON.parse(promotion.condition_value);
                    const productIds = orderItems.map(item => item.product_id);
                    const products = yield this.productsRepository.find({
                        where: { id: productIds },
                    });
                    return products.some(p => categoryIds.includes(p.category_id));
                case Promotions_1.PromotionCondition.SpecificProduct:
                    if (!promotion.condition_value)
                        return false;
                    const requiredProductIds = JSON.parse(promotion.condition_value);
                    const orderProductIds = orderItems.map(item => item.product_id);
                    return requiredProductIds.some(id => orderProductIds.includes(id));
                default:
                    return false;
            }
        });
    }
    /**
     * Calculate discount amount
     */
    calculateDiscount(promotion, orderItems, totalAmount) {
        switch (promotion.promotion_type) {
            case Promotions_1.PromotionType.PercentageOff:
                if (promotion.discount_percentage) {
                    return (totalAmount * promotion.discount_percentage) / 100;
                }
                return 0;
            case Promotions_1.PromotionType.FixedAmountOff:
                return promotion.discount_amount || 0;
            case Promotions_1.PromotionType.BuyXGetY:
                // Calculate based on buy X get Y logic
                if (promotion.buy_quantity && promotion.get_quantity) {
                    // This is simplified - actual implementation would need product matching
                    const applicableItems = orderItems.filter(item => {
                        // Check if item matches condition
                        return true; // Simplified
                    });
                    // Calculate free items
                    return 0; // Simplified
                }
                return 0;
            case Promotions_1.PromotionType.FreeShipping:
                // Return shipping cost if applicable
                return 0; // Would need shipping cost from order
            case Promotions_1.PromotionType.MinimumPurchase:
                if (promotion.minimum_purchase && totalAmount >= promotion.minimum_purchase) {
                    return promotion.discount_amount || 0;
                }
                return 0;
            default:
                return 0;
        }
    }
    /**
     * Apply promotion and increment usage count
     */
    applyPromotion(code, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const promotion = yield this.promotionsRepository.findOne({
                where: {
                    promotion_code: code,
                    is_active: true,
                    branch_id: branchId || undefined,
                },
            });
            if (!promotion) {
                throw AppError_1.AppError.notFound("Promotion not found");
            }
            // Increment usage count
            promotion.usage_count = (promotion.usage_count || 0) + 1;
            const saved = yield this.promotionsRepository.save(promotion);
            // Emit socket event
            this.socketService.emitToBranch(branchId || '', 'promotions:updated', saved);
            return saved;
        });
    }
    /**
     * Get all active promotions
     */
    getActivePromotions(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const query = this.promotionsRepository
                .createQueryBuilder('promotion')
                .where('promotion.is_active = :isActive', { isActive: true })
                .andWhere('(promotion.start_date IS NULL OR promotion.start_date <= :now)', { now })
                .andWhere('(promotion.end_date IS NULL OR promotion.end_date >= :now)', { now });
            if (branchId) {
                query.andWhere('(promotion.branch_id = :branchId OR promotion.branch_id IS NULL)', { branchId });
            }
            return query.getMany();
        });
    }
    /**
     * Get all promotions (with optional filters)
     */
    getAll(branchId, isActive) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = this.promotionsRepository.createQueryBuilder('promotion');
            if (branchId) {
                query.andWhere('(promotion.branch_id = :branchId OR promotion.branch_id IS NULL)', { branchId });
            }
            if (isActive !== undefined) {
                query.andWhere('promotion.is_active = :isActive', { isActive });
            }
            return query.orderBy('promotion.create_date', 'DESC').getMany();
        });
    }
    /**
     * Get promotion by ID
     */
    getById(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = this.promotionsRepository
                .createQueryBuilder('promotion')
                .where('promotion.id = :id', { id });
            if (branchId) {
                query.andWhere('(promotion.branch_id = :branchId OR promotion.branch_id IS NULL)', { branchId });
            }
            return query.getOne();
        });
    }
    /**
     * Create new promotion
     */
    create(data, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if promotion code already exists
            const existing = yield this.promotionsRepository.findOne({
                where: {
                    promotion_code: data.promotion_code,
                    branch_id: branchId || undefined,
                },
            });
            if (existing) {
                throw AppError_1.AppError.conflict("Promotion code already exists");
            }
            const promotion = this.promotionsRepository.create(Object.assign(Object.assign({}, data), { branch_id: branchId || data.branch_id, usage_count: 0, create_date: new Date(), update_date: new Date() }));
            const saved = yield this.promotionsRepository.save(promotion);
            // Emit socket event
            this.socketService.emitToBranch(branchId || '', 'promotions:updated', saved);
            return saved;
        });
    }
    /**
     * Update promotion
     */
    update(id, data, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const promotion = yield this.getById(id, branchId);
            if (!promotion) {
                throw AppError_1.AppError.notFound("Promotion not found");
            }
            // Check if promotion code is being changed and if it conflicts
            if (data.promotion_code && data.promotion_code !== promotion.promotion_code) {
                const existing = yield this.promotionsRepository.findOne({
                    where: {
                        promotion_code: data.promotion_code,
                        branch_id: branchId || promotion.branch_id || undefined,
                    },
                });
                if (existing && existing.id !== id) {
                    throw AppError_1.AppError.conflict("Promotion code already exists");
                }
            }
            // Update fields
            Object.assign(promotion, Object.assign(Object.assign({}, data), { update_date: new Date() }));
            const saved = yield this.promotionsRepository.save(promotion);
            // Emit socket event
            this.socketService.emitToBranch(branchId || promotion.branch_id || '', 'promotions:updated', saved);
            return saved;
        });
    }
    /**
     * Delete promotion
     */
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const promotion = yield this.getById(id, branchId);
            if (!promotion) {
                throw AppError_1.AppError.notFound("Promotion not found");
            }
            yield this.promotionsRepository.remove(promotion);
            // Emit socket event
            this.socketService.emitToBranch(branchId || promotion.branch_id || '', 'promotions:deleted', { id });
        });
    }
}
exports.PromotionsService = PromotionsService;
