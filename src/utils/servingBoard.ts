import { OrderType, ServingStatus } from "../entity/pos/OrderEnums";

export type ServingBoardRow = {
    item_id: string;
    order_id: string;
    order_no: string;
    order_type: OrderType;
    order_status: string;
    delivery_code: string | null;
    table_name: string | null;
    delivery_name: string | null;
    product_id: string;
    display_name: string;
    product_image_url: string | null;
    quantity: number;
    notes: string | null;
    serving_status: ServingStatus;
    serving_group_id: string;
    serving_group_created_at: Date | string;
    details: { detail_name: string; extra_price: number }[] | string;
};

export type ServingBoardItem = {
    id: string;
    product_id: string;
    display_name: string;
    product_image_url: string | null;
    quantity: number;
    notes: string | null;
    serving_status: ServingStatus;
    details: { detail_name: string; extra_price: number }[];
};

export type ServingBoardGroup = {
    id: string;
    order_id: string;
    order_no: string;
    order_type: OrderType;
    order_status: string;
    source_title: string;
    source_subtitle: string | null;
    batch_created_at: string;
    pending_count: number;
    served_count: number;
    total_items: number;
    items: ServingBoardItem[];
};

function normalizeValue(value: unknown): string {
    return String(value ?? "").trim();
}

function toIso(value: Date | string): string {
    if (value instanceof Date) {
        return value.toISOString();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function getServingBoardSource(
    row: Pick<ServingBoardRow, "order_type" | "table_name" | "delivery_name" | "delivery_code" | "order_no">
): {
    title: string;
    subtitle: string | null;
} {
    if (row.order_type === OrderType.DineIn) {
        const tableName = normalizeValue(row.table_name) || "-";
        return {
            title: `Dine in โต๊ะ ${tableName}`,
            subtitle: normalizeValue(row.order_no) || null,
        };
    }

    if (row.order_type === OrderType.Delivery) {
        const provider = normalizeValue(row.delivery_name) || "Delivery";
        const code = normalizeValue(row.delivery_code) || normalizeValue(row.order_no) || null;
        return {
            title: `Delivery ${provider}`,
            subtitle: code,
        };
    }

    const takeAwayRef = normalizeValue(row.delivery_code) || normalizeValue(row.order_no) || "-";
    return {
        title: `Take away ${takeAwayRef}`,
        subtitle: normalizeValue(row.order_no) || null,
    };
}

export function groupServingBoardRows(rows: ServingBoardRow[]): ServingBoardGroup[] {
    const groups = new Map<string, ServingBoardGroup>();

    rows.forEach((row) => {
        const existing = groups.get(row.serving_group_id);
        if (!existing) {
            const source = getServingBoardSource(row);
            groups.set(row.serving_group_id, {
                id: row.serving_group_id,
                order_id: row.order_id,
                order_no: row.order_no,
                order_type: row.order_type,
                order_status: row.order_status,
                source_title: source.title,
                source_subtitle: source.subtitle,
                batch_created_at: toIso(row.serving_group_created_at),
                pending_count: 0,
                served_count: 0,
                total_items: 0,
                items: [],
            });
        }

        const group = groups.get(row.serving_group_id)!;
        let parsedDetails: { detail_name: string; extra_price: number }[] = [];

        try {
            parsedDetails = typeof row.details === "string" ? JSON.parse(row.details) : (row.details || []);
        } catch {
            parsedDetails = [];
        }

        group.items.push({
            id: row.item_id,
            product_id: row.product_id,
            display_name: row.display_name,
            product_image_url: row.product_image_url,
            quantity: Number(row.quantity || 0),
            notes: row.notes || null,
            serving_status: row.serving_status,
            details: parsedDetails,
        });

        group.total_items += 1;
        if (row.serving_status === ServingStatus.Served) {
            group.served_count += 1;
        } else {
            group.pending_count += 1;
        }
    });

    return Array.from(groups.values()).sort((left, right) => {
        const leftTime = new Date(left.batch_created_at).getTime();
        const rightTime = new Date(right.batch_created_at).getTime();
        return rightTime - leftTime;
    });
}
