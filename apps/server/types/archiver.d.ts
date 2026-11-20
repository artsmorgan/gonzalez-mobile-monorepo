declare module "archiver" {
    import type { Readable } from "stream";

    interface ArchiverError extends Error {
        code?: string;
    }

    interface EntryData {
        name?: string;
        prefix?: string;
        stats?: import("fs").Stats;
    }

    interface Archiver extends Readable {
        on(event: "error", listener: (err: ArchiverError) => void): this;
        on(event: "warning", listener: (err: ArchiverError) => void): this;
        on(event: "data", listener: (data: Buffer) => void): this;
        on(event: "end", listener: () => void): this;
        append(source: Buffer | Readable | string, data?: EntryData): this;
        finalize(): Promise<void>;
    }

    function archiver(format: "zip", options?: { zlib?: { level?: number } }): Archiver;
    export default archiver;
}
