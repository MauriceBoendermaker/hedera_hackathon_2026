/**
 * Validates that a URL is safe to use as an href / redirect target.
 * Blocks non-http(s) schemes (javascript:, data:, etc.), embedded credentials,
 * and private/reserved IP ranges.
 */
export function isSafeUrl(raw: string): boolean {
    try {
        const u = new URL(raw);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        if (u.username || u.password) return false;

        const h = u.hostname.toLowerCase();

        // Strip IPv6 brackets for uniform matching
        const bare = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h;

        // Block IPv6 private/reserved ranges
        if (bare.includes(':')) {
            // ::1 loopback, fc00::/7 unique-local, fe80::/10 link-local, :: unspecified
            if (
                bare === '::1' || bare === '::' ||
                /^fc/.test(bare) || /^fd/.test(bare) ||
                /^fe[89ab]/.test(bare)
            ) return false;
        }

        // Block IPv4 private/reserved ranges
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) {
            const parts = bare.split('.').map(Number);
            const [a, b] = parts;
            if (
                a === 0 ||                              // 0.0.0.0/8
                a === 10 ||                             // 10.0.0.0/8
                a === 127 ||                            // 127.0.0.0/8
                (a === 169 && b === 254) ||             // 169.254.0.0/16 link-local
                (a === 172 && b >= 16 && b <= 31) ||    // 172.16.0.0/12
                (a === 192 && b === 168) ||             // 192.168.0.0/16
                (a === 100 && b >= 64 && b <= 127) ||   // 100.64.0.0/10 CGNAT
                (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmarking
                a >= 224                                 // 224+ multicast & reserved
            ) return false;
        }

        // Block known local/internal hostnames
        if (
            bare === 'localhost' ||
            bare.endsWith('.local') ||
            bare.endsWith('.internal') ||
            bare.endsWith('.localhost')
        ) return false;

        return true;
    } catch {
        return false;
    }
}
