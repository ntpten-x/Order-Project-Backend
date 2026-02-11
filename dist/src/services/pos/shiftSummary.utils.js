"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumPaymentAmount = exports.filterSuccessfulPayments = exports.SUCCESS_PAYMENT_STATUS = void 0;
exports.SUCCESS_PAYMENT_STATUS = "Success";
const filterSuccessfulPayments = (payments) => {
    return payments.filter((p) => p.status === exports.SUCCESS_PAYMENT_STATUS);
};
exports.filterSuccessfulPayments = filterSuccessfulPayments;
const sumPaymentAmount = (payments) => {
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
};
exports.sumPaymentAmount = sumPaymentAmount;
