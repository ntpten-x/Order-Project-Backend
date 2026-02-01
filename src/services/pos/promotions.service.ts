import { AppDataSource } from "../../database/database";
import { Promotions, PromotionType, PromotionCondition } from "../../entity/pos/Promotions";
import { Products } from "../../entity/pos/Products";
import { Category } from "../../entity/pos/Category";
import { SocketService } from "../socket.service";
import { AppError } from "../../utils/AppError";

interface PromotionEligibility {
    eligible: boolean;
    discountAmount: number;
    message?: string;
}

export class PromotionsService {
    private promotionsRepository = AppDataSource.getRepository(Promotions);
    private productsRepository = AppDataSource.getRepository(Products);
    private categoryRepository = AppDataSource.getRepository(Category);
    private socketService = SocketService.getInstance();

    /**
     * Check if promotion code is valid and applicable
     */
    async validatePromotionCode(
        code: string,
        orderItems: Array<{ product_id: string; quantity: number; price: number }>,
        totalAmount: number,
        branchId?: string
    ): Promise<PromotionEligibility> {
        const promotion = await this.promotionsRepository.findOne({
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
        const conditionMet = await this.checkCondition(promotion, orderItems, totalAmount);
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
    }

    /**
     * Check if order meets promotion conditions
     */
    private async checkCondition(
        promotion: Promotions,
        orderItems: Array<{ product_id: string; quantity: number; price: number }>,
        totalAmount: number
    ): Promise<boolean> {
        switch (promotion.condition_type) {
            case PromotionCondition.AllProducts:
                return true;

            case PromotionCondition.MinimumAmount:
                return totalAmount >= (promotion.minimum_purchase || 0);

            case PromotionCondition.SpecificCategory:
                if (!promotion.condition_value) return false;
                const categoryIds = JSON.parse(promotion.condition_value) as string[];
                const productIds = orderItems.map(item => item.product_id);
                const products = await this.productsRepository.find({
                    where: { id: productIds as any },
                });
                return products.some(p => categoryIds.includes(p.category_id));

            case PromotionCondition.SpecificProduct:
                if (!promotion.condition_value) return false;
                const requiredProductIds = JSON.parse(promotion.condition_value) as string[];
                const orderProductIds = orderItems.map(item => item.product_id);
                return requiredProductIds.some(id => orderProductIds.includes(id));

            default:
                return false;
        }
    }

    /**
     * Calculate discount amount
     */
    private calculateDiscount(
        promotion: Promotions,
        orderItems: Array<{ product_id: string; quantity: number; price: number }>,
        totalAmount: number
    ): number {
        switch (promotion.promotion_type) {
            case PromotionType.PercentageOff:
                if (promotion.discount_percentage) {
                    return (totalAmount * promotion.discount_percentage) / 100;
                }
                return 0;

            case PromotionType.FixedAmountOff:
                return promotion.discount_amount || 0;

            case PromotionType.BuyXGetY:
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

            case PromotionType.FreeShipping:
                // Return shipping cost if applicable
                return 0; // Would need shipping cost from order

            case PromotionType.MinimumPurchase:
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
    async applyPromotion(code: string, branchId?: string): Promise<Promotions> {
        const promotion = await this.promotionsRepository.findOne({
            where: {
                promotion_code: code,
                is_active: true,
                branch_id: branchId || undefined,
            },
        });

        if (!promotion) {
            throw AppError.notFound("Promotion not found");
        }

        // Increment usage count
        promotion.usage_count = (promotion.usage_count || 0) + 1;
        const saved = await this.promotionsRepository.save(promotion);

        // Emit socket event
        this.socketService.emitToBranch(
            branchId || '',
            'promotions:updated',
            saved
        );

        return saved;
    }

    /**
     * Get all active promotions
     */
    async getActivePromotions(branchId?: string): Promise<Promotions[]> {
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
    }
}
