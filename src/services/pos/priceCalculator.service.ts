
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { Discounts, DiscountType } from "../../entity/pos/Discounts";

export interface PriceCalculationResult {
    subTotal: number;
    discountAmount: number;
    vatAmount: number;
    totalAmount: number;
}

export class PriceCalculatorService {
    private static VAT_RATE = 0.07; // 7%

    /**
     * Calculate total for a single item line
     * (Price * Quantity) - ItemDiscount
     */
    static calculateItemTotal(price: number, quantity: number, discount: number = 0): number {
        const gross = Number(price) * Number(quantity);
        return Math.max(0, gross - Number(discount));
    }

    /**
     * Calculate Order Totals
     * @param items List of OrderItems
     * @param discount Optional Discount entity applied to the Order
     * @param vatIncluded Whether VAT is included in the price or added on top (Default: Excluded / Added on top)
     */
    static calculateOrderTotal(
        items: SalesOrderItem[],
        discount?: Discounts | null,
        vatIncluded: boolean = false
    ): PriceCalculationResult {
        // 1. Calculate Subtotal (Sum of all items)
        const subTotal = items.reduce((sum, item) => sum + Number(item.total_price), 0);

        // 2. Calculate Order-level Discount
        let discountAmount = 0;
        if (discount && discount.is_active) {
            if (discount.discount_type === DiscountType.Percentage) {
                // Percentage Discount
                discountAmount = (subTotal * Number(discount.discount_amount)) / 100;
            } else {
                // Fixed Amount Discount
                discountAmount = Number(discount.discount_amount);
            }
        }

        // Ensure discount doesn't exceed subtotal
        discountAmount = Math.min(discountAmount, subTotal);

        // 3. Calculate VAT
        // Base Amount for VAT = Subtotal - Discount
        const amountAfterDiscount = subTotal - discountAmount;
        let vatAmount = 0;

        if (vatIncluded) {
            // Price includes VAT (e.g. 107 baht -> VAT 7)
            // Formula: Amount * (Rate / (1 + Rate))
            vatAmount = amountAfterDiscount * (PriceCalculatorService.VAT_RATE / (1 + PriceCalculatorService.VAT_RATE));
        } else {
            // Price excludes VAT (e.g. 100 baht -> VAT 7 -> Total 107)
            vatAmount = amountAfterDiscount * PriceCalculatorService.VAT_RATE;
        }

        // 4. Calculate Net Total
        let totalAmount = 0;
        if (vatIncluded) {
            totalAmount = amountAfterDiscount; // Already includes VAT
        } else {
            totalAmount = amountAfterDiscount + vatAmount;
        }

        // Rounding to 2 decimal places
        return {
            subTotal: Number(subTotal.toFixed(2)),
            discountAmount: Number(discountAmount.toFixed(2)),
            vatAmount: Number(vatAmount.toFixed(2)),
            totalAmount: Number(totalAmount.toFixed(2))
        };
    }
}
