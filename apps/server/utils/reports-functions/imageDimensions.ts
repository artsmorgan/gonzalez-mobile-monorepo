import fs from "fs/promises";

/** Dimensiones en píxeles naturales del archivo (PNG, JPEG; WebP VP8X / VP8L). */
export function getImageDimensionsFromBuffer(buf: Buffer): { width: number; height: number } | null {
    if (!buf || buf.length < 9) return null;
    // PNG: IHDR width/height at 16–23.
    if (
        buf.length >= 24 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
    ) {
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        if (width > 0 && height > 0) return { width, height };
    }
    // JPEG: marcas SOF.
    if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
        let i = 2;
        while (i + 9 < buf.length) {
            if (buf[i] !== 0xff) {
                i += 1;
                continue;
            }
            const marker = buf[i + 1];
            const isSof =
                marker === 0xc0 ||
                marker === 0xc1 ||
                marker === 0xc2 ||
                marker === 0xc3 ||
                marker === 0xc5 ||
                marker === 0xc6 ||
                marker === 0xc7 ||
                marker === 0xc9 ||
                marker === 0xca ||
                marker === 0xcb ||
                marker === 0xcd ||
                marker === 0xce ||
                marker === 0xcf;
            if (isSof) {
                const height = buf.readUInt16BE(i + 5);
                const width = buf.readUInt16BE(i + 7);
                if (width > 0 && height > 0) return { width, height };
                break;
            }
            const len = buf.readUInt16BE(i + 2);
            if (!Number.isFinite(len) || len < 2) break;
            i += 2 + len;
        }
    }
    // WebP (RIFF): VP8X ( lienzo ) o VP8L ( lossless ).
    if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
        let p = 12;
        while (p + 8 <= buf.length) {
            const tag = buf.toString("ascii", p, p + 4);
            const size = buf.readUInt32LE(p + 4);
            if (!Number.isFinite(size) || size < 0 || size > buf.length * 2) break;
            const padded = size + (size & 1);
            const dataOff = p + 8;
            if (tag === "VP8X" && size >= 10) {
                const w = buf.readUIntLE(dataOff + 4, 3) + 1;
                const h = buf.readUIntLE(dataOff + 7, 3) + 1;
                if (w > 0 && h > 0) return { width: w, height: h };
            }
            if (tag === "VP8L" && size >= 5) {
                if (buf[dataOff] === 0x2f) {
                    const bits = buf.readUInt32LE(dataOff + 1);
                    const w = (bits & 0x3fff) + 1;
                    const h = ((bits >> 14) & 0x3fff) + 1;
                    if (w > 0 && h > 0) return { width: w, height: h };
                }
            }
            const next = dataOff + padded;
            if (next <= p) break;
            p = next;
        }
    }
    return null;
}

export async function getImageDimensionsFromFile(filePath: string): Promise<{ width: number; height: number } | null> {
    try {
        const buf = await fs.readFile(filePath);
        return getImageDimensionsFromBuffer(buf);
    } catch {
        return null;
    }
}

/**
 * Escala la imagen para caber en [maxW × maxH] manteniendo proporción (contain).
 */
export function fitImageExtInsideBox(
    origW: number,
    origH: number,
    maxW: number,
    maxH: number,
): { width: number; height: number } {
    const ow = Math.max(1, origW);
    const oh = Math.max(1, origH);
    const scale = Math.min(maxW / ow, maxH / oh);
    return {
        width: Math.max(1, Math.round(ow * scale)),
        height: Math.max(1, Math.round(oh * scale)),
    };
}
