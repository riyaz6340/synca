/**
 * shareFile — a thin, testable wrapper around the device share sheet for
 * handing a generated file (e.g. an attendance report PDF) to the user so they
 * can save or share it (Requirement 15.4).
 *
 * Why a wrapper? The project does not yet depend on `expo-sharing` /
 * `expo-file-system` (see package.json). Rather than couple screens directly to
 * those native modules, callers depend on this small interface:
 *
 *     await sharePdf(bytes, { filename: 'report.pdf' });
 *
 * The implementation loads the expo modules lazily/optionally. When they are
 * installed it writes the bytes to a cache file and opens the native share
 * sheet. When they are NOT installed it throws {@link ShareUnavailableError}
 * with a clear message so the screen can surface a friendly alert. Wiring the
 * real native share therefore only requires adding the two expo dependencies —
 * no call-site changes.
 *
 * Screens import `sharePdf` and tests mock this module, keeping the export flow
 * fully unit-testable without native modules.
 */

/** Default MIME type for the attendance report export. */
export const PDF_MIME_TYPE = 'application/pdf';

export interface SharePdfOptions {
  /** File name (with `.pdf` extension) presented in the share sheet. */
  filename: string;
  /** Override the MIME type; defaults to {@link PDF_MIME_TYPE}. */
  mimeType?: string;
  /** Dialog title shown by the Android share sheet. */
  dialogTitle?: string;
}

/**
 * Thrown when the native share capability is unavailable — either the optional
 * expo modules are not installed, or the platform does not support sharing.
 */
export class ShareUnavailableError extends Error {
  constructor(message = 'Sharing is not available on this device.') {
    super(message);
    this.name = 'ShareUnavailableError';
  }
}

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode raw bytes to a base64 string. Implemented locally because React
 * Native does not ship Node's `Buffer` and we want to avoid pulling in a
 * polyfill just for the export path.
 */
export function bytesToBase64(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let result = '';
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    const triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result +=
      BASE64_CHARS[(triplet >> 18) & 0x3f] +
      BASE64_CHARS[(triplet >> 12) & 0x3f] +
      BASE64_CHARS[(triplet >> 6) & 0x3f] +
      BASE64_CHARS[triplet & 0x3f];
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const chunk = bytes[i] << 16;
    result +=
      BASE64_CHARS[(chunk >> 18) & 0x3f] + BASE64_CHARS[(chunk >> 12) & 0x3f] + '==';
  } else if (remaining === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8);
    result +=
      BASE64_CHARS[(chunk >> 18) & 0x3f] +
      BASE64_CHARS[(chunk >> 12) & 0x3f] +
      BASE64_CHARS[(chunk >> 6) & 0x3f] +
      '=';
  }

  return result;
}

/**
 * Optionally load the expo modules. Returns `null` when they aren't installed
 * so callers can degrade gracefully rather than crash at import time.
 */
function loadExpoModules(): {
  FileSystem: any;
  Sharing: any;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FileSystem = require('expo-file-system');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sharing = require('expo-sharing');
    return { FileSystem, Sharing };
  } catch {
    return null;
  }
}

/**
 * Persist `bytes` to a temporary file and open the device share sheet.
 *
 * @throws {ShareUnavailableError} when the native share capability is missing.
 */
export async function sharePdf(
  bytes: ArrayBuffer | Uint8Array,
  options: SharePdfOptions,
): Promise<void> {
  const { filename, mimeType = PDF_MIME_TYPE, dialogTitle } = options;

  const modules = loadExpoModules();
  if (!modules) {
    throw new ShareUnavailableError(
      'Sharing requires the expo-sharing and expo-file-system packages, which are not installed.',
    );
  }

  const { FileSystem, Sharing } = modules;

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new ShareUnavailableError();
  }

  const base64 = bytesToBase64(bytes);
  const fileUri = `${FileSystem.cacheDirectory ?? ''}${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType?.Base64 ?? 'base64',
  });

  await Sharing.shareAsync(fileUri, { mimeType, dialogTitle, UTI: 'com.adobe.pdf' });
}

export default sharePdf;
