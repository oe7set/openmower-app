// Helpers for displaying MQTT URLs in the UI without leaking credentials.

/** Replaces the password segment of an MQTT URL with stars. Falls back to the
 * raw input if parsing fails — better to show a redactable URL than to drop
 * useful diagnostic context. */
export function maskPassword(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.password) {
      const decoded = decodeURIComponent(u.password);
      return rawUrl.replace(`:${decoded}@`, `:${'*'.repeat(decoded.length)}@`);
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}
