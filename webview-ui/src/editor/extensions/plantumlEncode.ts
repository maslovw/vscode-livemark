/**
 * Encode a PlantUML diagram source into a URL-safe string for the PlantUML
 * server.  The encoding is:
 *   1. UTF-8 encode the source text
 *   2. Deflate (raw, no gzip/zlib header)
 *   3. PlantUML's custom Base64 alphabet (0-9A-Za-z-_)
 *
 * Uses the browser-native CompressionStream('deflate-raw') API which is
 * available in all Chromium-based environments (including VS Code webviews).
 */

// PlantUML uses a custom 6-bit encoding alphabet
const PLANTUML_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function encode6bit(value: number): string {
  return PLANTUML_ALPHABET[value & 0x3f];
}

function encode3bytes(b1: number, b2: number, b3: number): string {
  return (
    encode6bit(b1 >> 2) +
    encode6bit(((b1 & 0x3) << 4) | (b2 >> 4)) +
    encode6bit(((b2 & 0xf) << 2) | (b3 >> 6)) +
    encode6bit(b3 & 0x3f)
  );
}

function plantumlBase64Encode(data: Uint8Array): string {
  let result = "";
  const len = data.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = data[i];
    const b2 = i + 1 < len ? data[i + 1] : 0;
    const b3 = i + 2 < len ? data[i + 2] : 0;
    result += encode3bytes(b1, b2, b3);
  }
  return result;
}

/**
 * Compress data using raw deflate via CompressionStream.
 */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  writer.write(new Uint8Array(data) as any);
  writer.close();

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  // Concatenate chunks
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Encode a PlantUML diagram source into the encoded string used in server URLs.
 *
 * @param source The PlantUML diagram source text
 * @returns The encoded string (to be appended to the server URL path)
 */
export async function plantumlEncode(source: string): Promise<string> {
  const utf8 = new TextEncoder().encode(source);
  const deflated = await deflateRaw(utf8);
  return plantumlBase64Encode(deflated);
}

/**
 * Build a full PlantUML server URL for SVG rendering.
 *
 * @param source  The PlantUML diagram source text
 * @param server  The PlantUML server base URL (e.g. "https://www.plantuml.com/plantuml")
 * @returns The full URL to the rendered SVG
 */
export async function plantumlServerUrl(
  source: string,
  server: string
): Promise<string> {
  const encoded = await plantumlEncode(source);
  const base = server.replace(/\/+$/, "");
  return `${base}/svg/${encoded}`;
}
