type PaymentLike = {
    amount?: number | string;
    status?: string;
    payment_method?: {
        payment_method_name?: string;
        display_name?: string;
    } | null;
};

export const SUCCESS_PAYMENT_STATUS = "Success";

export const filterSuccessfulPayments = <T extends PaymentLike>(payments: T[]): T[] => {
    return payments.filter((payment) => payment.status === SUCCESS_PAYMENT_STATUS);
};

export const sumPaymentAmount = (payments: PaymentLike[]): number => {
    return payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
};

const CASH_TOKENS = ["cash", "เงินสด"];

export const isCashPayment = (payment: PaymentLike): boolean => {
    const methodName =
        `${payment.payment_method?.payment_method_name || ""} ${payment.payment_method?.display_name || ""}`
            .toLowerCase();
    return CASH_TOKENS.some((token) => methodName.includes(token));
};

export const sumCashPaymentAmount = (payments: PaymentLike[]): number => {
    return payments.reduce((sum, payment) => {
        if (!isCashPayment(payment)) return sum;
        return sum + Number(payment.amount || 0);
    }, 0);
};
