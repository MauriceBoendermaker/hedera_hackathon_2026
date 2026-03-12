/**
 * Validates that a URL is safe to use as an href / redirect target.
 * Blocks non-http(s) schemes (javascript:, data:, etc.) and private/loopback IPs.
 */
export function isSafeUrl(raw: string): boolean {
    try {
        const u = new URL(raw);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        const h = u.hostname.toLowerCase();
        if (
            h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' ||
            h === '[::1]' || h === '::1' ||
            h.startsWith('10.') || h.startsWith('192.168.') ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
            h.endsWith('.local') || h.endsWith('.internal')
        ) return false;
        return true;
    } catch {
        return false;
    }
}
