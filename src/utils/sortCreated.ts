export type CreatedSort = "old" | "new";

export const DEFAULT_CREATED_SORT: CreatedSort = "old";

export function parseCreatedSort(value: unknown): CreatedSort {
    if (typeof value !== "string") return DEFAULT_CREATED_SORT;
    const normalized = value.trim().toLowerCase();
    return normalized === "new" ? "new" : DEFAULT_CREATED_SORT;
}

export function createdSortToOrder(sort: CreatedSort): "ASC" | "DESC" {
    return sort === "new" ? "DESC" : "ASC";
}
