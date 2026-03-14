import { getRedisClient, getRedisPrefix } from "../../lib/redisClient";

type VersionEntry = {
    value: number;
    expiresAt: number;
};

const VERSION_PREFIX = getRedisPrefix("pos-read-model-version");
const LOCAL_TTL_MS = Number(process.env.POS_READ_MODEL_VERSION_LOCAL_TTL_MS || 250);
const localVersions = new Map<string, VersionEntry>();
const inflightReads = new Map<string, Promise<number>>();

function getScopeId(branchId?: string): string {
    return branchId ? `branch:${branchId}` : "global";
}

function getStorageKey(namespace: string, branchId?: string): string {
    return `${VERSION_PREFIX}${namespace}:${getScopeId(branchId)}`;
}

function readLocalVersion(storageKey: string): number | undefined {
    const entry = localVersions.get(storageKey);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        localVersions.delete(storageKey);
        return undefined;
    }
    return entry.value;
}

function writeLocalVersion(storageKey: string, value: number): number {
    localVersions.set(storageKey, {
        value,
        expiresAt: Date.now() + LOCAL_TTL_MS,
    });
    return value;
}

export async function getReadModelVersionToken(namespace: string, branchId?: string): Promise<string> {
    const storageKey = getStorageKey(namespace, branchId);
    const localValue = readLocalVersion(storageKey);
    if (localValue !== undefined) {
        return `v${localValue}`;
    }

    const inFlight = inflightReads.get(storageKey);
    if (inFlight) {
        return `v${await inFlight}`;
    }

    const readPromise = (async () => {
        const redis = await getRedisClient();
        if (!redis) {
            return writeLocalVersion(storageKey, 0);
        }

        const raw = await redis.get(storageKey);
        const nextValue = Number(raw || 0);
        if (!Number.isFinite(nextValue) || nextValue < 0) {
            return writeLocalVersion(storageKey, 0);
        }
        return writeLocalVersion(storageKey, Math.trunc(nextValue));
    })().finally(() => {
        inflightReads.delete(storageKey);
    });

    inflightReads.set(storageKey, readPromise);
    return `v${await readPromise}`;
}

export async function bumpReadModelVersion(namespace: string, branchId?: string): Promise<number> {
    const storageKey = getStorageKey(namespace, branchId);
    const redis = await getRedisClient();

    if (!redis) {
        const nextValue = (readLocalVersion(storageKey) ?? 0) + 1;
        return writeLocalVersion(storageKey, nextValue);
    }

    const nextValue = await redis.incr(storageKey);
    return writeLocalVersion(storageKey, nextValue);
}
