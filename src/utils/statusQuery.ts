export const parseStatusQuery = (raw?: string): string[] | undefined => {
    if (!raw) return undefined;
    const statuses = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return statuses.length > 0 ? statuses : undefined;
};

