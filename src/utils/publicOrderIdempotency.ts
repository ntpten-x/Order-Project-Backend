import { createHash } from "node:crypto";
import { getRedisClient, getRedisPrefix } from "../lib/redisClient";
import { AppError } from "./AppError";
import { ErrorCodes } from "./ApiResponse";

type StoredResponse = {
    statusCode: number;
    body: unknown;
};

type StoredRecord =
    | {
          status: "in_progress";
          fingerprint: string;
          createdAt: number;
      }
    | {
          status: "completed";
          fingerprint: string;
          response: StoredResponse;
          createdAt: number;
          completedAt: number;
      };

export type PublicOrderIdempotencyReservation = {
    key: string;
    fingerprint: string;
};

export type PublicOrderIdempotencyReserveResult =
    | { status: "disabled" }
    | { status: "acquired"; reservation: PublicOrderIdempotencyReservation }
    | { status: "replay"; response: StoredResponse }
    | { status: "in_progress" }
    | { status: "conflict" };

const IDEMPOTENCY_ENABLED = process.env.PUBLIC_ORDER_IDEMPOTENCY_ENABLED !== "false";
const IDEMPOTENCY_TTL_MS = Number(process.env.PUBLIC_ORDER_IDEMPOTENCY_TTL_MS || 10 * 60 * 1000);
const IDEMPOTENCY_MAX_KEY_LENGTH = Number(process.env.PUBLIC_ORDER_IDEMPOTENCY_MAX_KEY_LENGTH || 120);
const IDEMPOTENCY_MEMORY_MAX_ENTRIES = Number(process.env.PUBLIC_ORDER_IDEMPOTENCY_MEMORY_MAX_ENTRIES || 5000);
const IDEMPOTENCY_PREFIX = getRedisPrefix("public-order-idempotency");
const IDEMPOTENCY_ALLOWED_KEY_PATTERN = /^[A-Za-z0-9:_\-\.]+$/;

type MemoryEntry = {
    record: StoredRecord;
    expiresAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();

function sanitizeTtlMs(): number {
    return Number.isFinite(IDEMPOTENCY_TTL_MS) && IDEMPOTENCY_TTL_MS > 0 ? IDEMPOTENCY_TTL_MS : 10 * 60 * 1000;
}

function normalizeIdempotencyKey(raw: string | undefined): string | null {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return null;

    if (trimmed.length > IDEMPOTENCY_MAX_KEY_LENGTH) {
        throw new AppError(
            `Idempotency-Key is too long (max ${IDEMPOTENCY_MAX_KEY_LENGTH} chars)`,
            400,
            ErrorCodes.VALIDATION_ERROR,
        );
    }

    if (!IDEMPOTENCY_ALLOWED_KEY_PATTERN.test(trimmed)) {
        throw new AppError(
            "Idempotency-Key contains unsupported characters",
            400,
            ErrorCodes.VALIDATION_ERROR,
        );
    }

    return trimmed;
}

function stableSerialize(value: unknown): string {
    if (value === null || value === undefined) return String(value);

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
    }

    if (typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
        return `{${entries
            .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerialize(nested)}`)
            .join(",")}}`;
    }

    return JSON.stringify(value);
}

function hashText(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function toStorageKey(token: string, idempotencyKey: string): string {
    return `${IDEMPOTENCY_PREFIX}${hashText(`${token}:${idempotencyKey}`)}`;
}

function toFingerprint(token: string, payload: unknown): string {
    return hashText(`${token}:${stableSerialize(payload)}`);
}

function pruneMemoryStore(): void {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
        if (entry.expiresAt <= now) {
            memoryStore.delete(key);
        }
    }

    if (memoryStore.size <= IDEMPOTENCY_MEMORY_MAX_ENTRIES) return;

    const entries = Array.from(memoryStore.entries()).sort((a, b) => a[1].record.createdAt - b[1].record.createdAt);
    const toRemove = memoryStore.size - IDEMPOTENCY_MEMORY_MAX_ENTRIES;
    for (let i = 0; i < toRemove; i += 1) {
        memoryStore.delete(entries[i][0]);
    }
}

function readFromMemory(storageKey: string): StoredRecord | null {
    pruneMemoryStore();
    const existing = memoryStore.get(storageKey);
    if (!existing) return null;
    if (existing.expiresAt <= Date.now()) {
        memoryStore.delete(storageKey);
        return null;
    }
    return existing.record;
}

function writeToMemory(storageKey: string, record: StoredRecord, onlyIfMissing: boolean): boolean {
    pruneMemoryStore();
    if (onlyIfMissing) {
        const existing = readFromMemory(storageKey);
        if (existing) return false;
    }
    memoryStore.set(storageKey, {
        record,
        expiresAt: Date.now() + sanitizeTtlMs(),
    });
    return true;
}

function deleteFromMemory(storageKey: string): void {
    memoryStore.delete(storageKey);
}

function parseStoredRecord(raw: string | null): StoredRecord | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as StoredRecord;
        if (!parsed || typeof parsed !== "object" || !("status" in parsed) || !("fingerprint" in parsed)) {
            return null;
        }
        if (parsed.status !== "in_progress" && parsed.status !== "completed") {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

async function readRecord(storageKey: string): Promise<StoredRecord | null> {
    const redis = await getRedisClient();
    if (!redis) return readFromMemory(storageKey);

    try {
        const record = parseStoredRecord(await redis.get(storageKey));
        if (!record) return null;
        return record;
    } catch {
        return readFromMemory(storageKey);
    }
}

async function writeRecord(storageKey: string, record: StoredRecord, onlyIfMissing: boolean): Promise<boolean> {
    const redis = await getRedisClient();
    const ttlMs = sanitizeTtlMs();

    if (!redis) return writeToMemory(storageKey, record, onlyIfMissing);

    try {
        if (onlyIfMissing) {
            const result = await redis.set(storageKey, JSON.stringify(record), { PX: ttlMs, NX: true });
            return result === "OK";
        }

        await redis.set(storageKey, JSON.stringify(record), { PX: ttlMs });
        return true;
    } catch {
        return writeToMemory(storageKey, record, onlyIfMissing);
    }
}

async function deleteRecord(storageKey: string): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) {
        deleteFromMemory(storageKey);
        return;
    }

    try {
        await redis.del(storageKey);
    } catch {
        deleteFromMemory(storageKey);
    }
}

function evaluateExistingRecord(
    existing: StoredRecord | null,
    fingerprint: string,
): PublicOrderIdempotencyReserveResult | null {
    if (!existing) return null;
    if (existing.fingerprint !== fingerprint) return { status: "conflict" };
    if (existing.status === "completed") {
        return {
            status: "replay",
            response: existing.response,
        };
    }
    return { status: "in_progress" };
}

export async function reservePublicOrderIdempotency(params: {
    token: string;
    idempotencyKeyHeader?: string;
    payload: unknown;
}): Promise<PublicOrderIdempotencyReserveResult> {
    if (!IDEMPOTENCY_ENABLED) return { status: "disabled" };

    const normalizedKey = normalizeIdempotencyKey(params.idempotencyKeyHeader);
    if (!normalizedKey) return { status: "disabled" };

    const storageKey = toStorageKey(params.token, normalizedKey);
    const fingerprint = toFingerprint(params.token, params.payload);
    const existing = evaluateExistingRecord(await readRecord(storageKey), fingerprint);
    if (existing) return existing;

    const now = Date.now();
    const acquired = await writeRecord(
        storageKey,
        {
            status: "in_progress",
            fingerprint,
            createdAt: now,
        },
        true,
    );

    if (acquired) {
        return {
            status: "acquired",
            reservation: {
                key: storageKey,
                fingerprint,
            },
        };
    }

    const afterRace = evaluateExistingRecord(await readRecord(storageKey), fingerprint);
    if (afterRace) return afterRace;

    return { status: "in_progress" };
}

export async function commitPublicOrderIdempotency(
    reservation: PublicOrderIdempotencyReservation,
    response: StoredResponse,
): Promise<void> {
    await writeRecord(
        reservation.key,
        {
            status: "completed",
            fingerprint: reservation.fingerprint,
            response,
            createdAt: Date.now(),
            completedAt: Date.now(),
        },
        false,
    );
}

export async function clearPublicOrderIdempotency(reservation: PublicOrderIdempotencyReservation): Promise<void> {
    await deleteRecord(reservation.key);
}

export function resetPublicOrderIdempotencyMemoryStoreForTests(): void {
    memoryStore.clear();
}
