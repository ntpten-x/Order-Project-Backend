import { AppError } from "../../utils/AppError";

type PromotionEligibility = {
  eligible: boolean;
  discountAmount: number;
  message?: string;
};

const removedMessage = "Promotions feature has been removed. Please use discounts instead.";

/**
 * Promotions feature has been removed in favor of Discounts.
 * This service remains as a stub to keep TypeScript builds stable.
 */
export class PromotionsService {
  async validatePromotionCode(): Promise<PromotionEligibility> {
    return { eligible: false, discountAmount: 0, message: removedMessage };
  }

  async applyPromotion(): Promise<never> {
    throw AppError.badRequest(removedMessage);
  }

  async getActivePromotions(): Promise<unknown[]> {
    return [];
  }

  async getAll(): Promise<unknown[]> {
    return [];
  }

  async getById(): Promise<null> {
    return null;
  }

  async create(): Promise<never> {
    throw AppError.badRequest(removedMessage);
  }

  async update(): Promise<never> {
    throw AppError.badRequest(removedMessage);
  }

  async delete(): Promise<never> {
    throw AppError.badRequest(removedMessage);
  }
}
