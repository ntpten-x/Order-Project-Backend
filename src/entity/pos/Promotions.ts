import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { Branch } from "../Branch";

export enum PromotionType {
    BuyXGetY = "BuyXGetY",           // ซื้อ X แถม Y
    PercentageOff = "PercentageOff", // ลดเปอร์เซ็นต์
    FixedAmountOff = "FixedAmountOff", // ลดจำนวนเงินคงที่
    FreeShipping = "FreeShipping",    // ฟรีค่าจัดส่ง
    Bundle = "Bundle",                // ชุดโปรโมชัน
    MinimumPurchase = "MinimumPurchase" // ซื้อขั้นต่ำ
}

export enum PromotionCondition {
    AllProducts = "AllProducts",     // ทุกสินค้า
    SpecificCategory = "SpecificCategory", // หมวดหมู่เฉพาะ
    SpecificProduct = "SpecificProduct",   // สินค้าเฉพาะ
    MinimumAmount = "MinimumAmount"  // ยอดซื้อขั้นต่ำ
}

@Entity("promotions")
@Index(["promotion_code", "branch_id"], { unique: true })
@Index(["branch_id", "is_active"])
export class Promotions {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 50 })
    promotion_code!: string; // รหัสโปรโมชัน

    @Column({ type: "varchar", length: 200 })
    name!: string; // ชื่อโปรโมชัน

    @Column({ type: "text", nullable: true })
    description?: string; // รายละเอียด

    @Index()
    @Column({ name: "branch_id", type: "uuid" })
    branch_id?: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: "branch_id" })
    branch?: Branch;

    @Column({ type: "enum", enum: PromotionType })
    promotion_type!: PromotionType;

    @Column({ type: "enum", enum: PromotionCondition })
    condition_type!: PromotionCondition;

    @Column({ type: "text", nullable: true })
    condition_value?: string; // JSON string สำหรับเงื่อนไข

    @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
    discount_amount?: number; // จำนวนส่วนลด

    @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
    discount_percentage?: number; // เปอร์เซ็นต์ส่วนลด

    @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
    minimum_purchase?: number; // ยอดซื้อขั้นต่ำ

    @Column({ type: "integer", nullable: true })
    buy_quantity?: number; // จำนวนที่ต้องซื้อ (สำหรับ BuyXGetY)

    @Column({ type: "integer", nullable: true })
    get_quantity?: number; // จำนวนที่ได้ฟรี (สำหรับ BuyXGetY)

    @Column({ type: "timestamptz", nullable: true })
    start_date?: Date; // วันที่เริ่มโปรโมชัน

    @Column({ type: "timestamptz", nullable: true })
    end_date?: Date; // วันที่สิ้นสุดโปรโมชัน

    @Column({ type: "integer", default: 0 })
    usage_limit?: number; // จำนวนครั้งที่ใช้ได้ (0 = ไม่จำกัด)

    @Column({ type: "integer", default: 0 })
    usage_count?: number; // จำนวนครั้งที่ใช้ไปแล้ว

    @Column({ type: "integer", default: 1 })
    usage_limit_per_user?: number; // จำนวนครั้งที่ใช้ได้ต่อผู้ใช้

    @Column({ type: "boolean", default: true })
    is_active!: boolean; // สถานะการใช้งาน

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    create_date!: Date;

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    update_date!: Date;
}
