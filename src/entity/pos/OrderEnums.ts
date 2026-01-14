
export enum OrderType {
    DineIn = "DineIn",      // ทานที่ร้าน
    TakeAway = "TakeAway",  // สั่งกลับบ้าน
    Delivery = "Delivery"   // เดลิเวอรี่
}

export enum OrderStatus {
    Pending = "Pending",    // รอรับออเดอร์
    Cooking = "Cooking",    // กำลังปรุงอาหาร
    Served = "Served",      // เสิร์ฟแล้ว
    WaitingForPayment = "WaitingForPayment", // รอชำระเงิน
    Paid = "Paid",          // ชำระเงินแล้ว
    Cancelled = "Cancelled", // ยกเลิกออเดอร์

    // Legacy values for migration
    pending = "pending",
    completed = "completed",
    cancelled = "cancelled"
}
