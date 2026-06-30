/**
 * Lightweight RFC-4122 version-4 UUID generator.
 *
 * The app does not need a cryptographically strong identifier for offline-queue
 * operation ids — they only have to be unique on-device. Using a tiny local
 * implementation avoids pulling in a native crypto dependency (expo-crypto) and
 * keeps the queue manager testable in a plain Node/Jest environment.
 *
 * Validates: Requirements 21.2
 */

/**
 * Generate a random v4 UUID string, e.g. `"110ec58a-a0f2-4ac4-8393-c866d813b8d1"`.
 */
export function uuidv4(): string {
  // Template with the version (4) and variant (8/9/a/b) bits fixed per RFC-4122.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default uuidv4;
