/**
 * ObjectId-shaped hex string (4-byte timestamp + 8 random bytes).
 *
 * The editor needs a template id before the template is saved, so uploaded images can
 * go straight into that template's folder instead of a shared dumping ground.
 */
export function newObjectIdHex() {
  const timestamp = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, '0');

  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const random = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return `${timestamp}${random}`;
}
