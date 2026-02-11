export type CanonicalRole = "Admin" | "Manager" | "Employee";

function normalizeToken(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

export function normalizeRoleName(value: unknown): CanonicalRole | null {
    const raw = normalizeToken(value);
    if (!raw) return null;

    if (raw === "admin") return "Admin";
    if (raw === "manager") return "Manager";
    if (raw === "employee") return "Employee";

    return null;
}
