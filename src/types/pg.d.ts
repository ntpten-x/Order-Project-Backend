declare module "pg" {
    export class Pool {
        constructor(config?: Record<string, unknown>);
        connect(): Promise<{
            query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
            release: () => void;
        }>;
        end(): Promise<void>;
    }
}
