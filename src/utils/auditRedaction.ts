const DEFAULT_REDACTED = "[REDACTED]";
const DEFAULT_TRUNCATED = "[TRUNCATED]";

export type AuditRedactionOptions = {
    maxDepth?: number;
    maxKeys?: number;
    maxArrayLength?: number;
    maxStringLength?: number;
    redactText?: string;
    truncatedText?: string;
};

// Keep this list conservative to avoid surprising redactions.
const SENSITIVE_KEY_REGEXES: RegExp[] = [
    /^password$/i,
    /^passcode$/i,
    /^pin$/i,
    /^otp$/i,
    /^secret$/i,
    /secret$/i,
    /^token$/i,
    /token$/i,
    /^access[_-]?token$/i,
    /^refresh[_-]?token$/i,
    /^api[_-]?key$/i,
    /api[_-]?key$/i,
    /^private[_-]?key$/i,
    /^client[_-]?secret$/i,
    /^authorization$/i,
    /^cookie$/i,
    /^csrf$/i,
    /^csrf[_-]?token$/i,
    /^session$/i,
    /^session[_-]?id$/i,
    /^card(_?number)?$/i,
    /^cvv$/i,
    /^cvc$/i,
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function shouldRedactKey(key: string): boolean {
    return SENSITIVE_KEY_REGEXES.some((re) => re.test(key));
}

function truncateString(input: string, max: number, truncatedText: string): string {
    if (input.length <= max) return input;
    return `${input.slice(0, max)}…${truncatedText}`;
}

function toJsonSafePrimitive(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
        };
    }
    return value;
}

export function redactAuditPayload(value: unknown, options: AuditRedactionOptions = {}): unknown {
    const maxDepth = options.maxDepth ?? 6;
    const maxKeys = options.maxKeys ?? 60;
    const maxArrayLength = options.maxArrayLength ?? 60;
    const maxStringLength = options.maxStringLength ?? 2000;
    const redactText = options.redactText ?? DEFAULT_REDACTED;
    const truncatedText = options.truncatedText ?? DEFAULT_TRUNCATED;

    const seen = new WeakSet<object>();

    const walk = (node: unknown, depth: number): unknown => {
        const prim = toJsonSafePrimitive(node);
        if (prim === null) return null;
        if (typeof prim === "string") return truncateString(prim, maxStringLength, truncatedText);
        if (typeof prim === "number" || typeof prim === "boolean") return prim;
        if (typeof prim === "bigint") return truncateString(String(prim), maxStringLength, truncatedText);
        if (typeof prim === "undefined") return undefined;
        if (typeof prim === "function" || typeof prim === "symbol") return undefined;

        if (!prim || typeof prim !== "object") return prim;

        if (seen.has(prim)) {
            return "[CIRCULAR]";
        }
        seen.add(prim);

        if (depth <= 0) {
            return truncatedText;
        }

        if (Array.isArray(prim)) {
            const arr = prim.slice(0, maxArrayLength).map((v) => walk(v, depth - 1));
            if (prim.length > maxArrayLength) arr.push(truncatedText);
            return arr;
        }

        // For non-plain objects (e.g. TypeORM entities), we still try to serialize enumerable props.
        const record: Record<string, unknown> = {};
        const entries = Object.entries(prim as Record<string, unknown>);
        const limited = entries.slice(0, maxKeys);
        for (const [key, val] of limited) {
            if (shouldRedactKey(key)) {
                record[key] = redactText;
            } else {
                record[key] = walk(val, depth - 1);
            }
        }
        if (entries.length > maxKeys) {
            record[truncatedText] = `keys>${maxKeys}`;
        }

        // Preserve a minimal shape for plain objects. For class instances, this is still safe JSON.
        if (isPlainObject(prim)) return record;
        return record;
    };

    return walk(value, maxDepth);
}
