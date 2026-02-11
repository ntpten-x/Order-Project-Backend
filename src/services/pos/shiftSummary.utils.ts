type PaymentLike = {
    amount?: number | string;
    status?: string;
};

export const SUCCESS_PAYMENT_STATUS = "Success";

export const filterSuccessfulPayments = <T extends PaymentLike>(payments: T[]): T[] => {
    return payments.filter((p) => p.status === SUCCESS_PAYMENT_STATUS);
};

export const sumPaymentAmount = (payments: PaymentLike[]): number => {
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
};

