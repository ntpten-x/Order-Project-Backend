
export enum OrderType {
    DineIn = "DineIn",      // ทานที่ร้าน
    TakeAway = "TakeAway",  // สั่งกลับบ้าน
    Delivery = "Delivery"   // เดลิเวอรี่
}

export enum OrderStatus {
    Pending = "Pending",    // กำลังดำเนินการ (สร้างออเดอร์แล้ว/กำลังทาน) -> Default
    Cooking = "Cooking",    // กำลังปรุงอาหาร
    Served = "Served",      // เสิร์ฟแล้ว
    WaitingForPayment = "WaitingForPayment", // รอชำระเงิน
    Paid = "Paid",          // ชำระเงินแล้ว (สำหรับรายการสินค้า)
    Completed = "Completed", // ออเดอร์สำเร็จ (สำหรับออเดอร์)
    Cancelled = "Cancelled", // ยกเลิกออเดอร์

    // Legacy values for migration
    pending = "pending",
    completed = "completed",
    cancelled = "cancelled"
}
