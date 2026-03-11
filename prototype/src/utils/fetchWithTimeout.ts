export function fetchWithTimeout(
    url: string,
    parentSignal: AbortSignal,
    timeoutMs: number,
    init?: RequestInit,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onParentAbort = () => controller.abort();
    parentSignal.addEventListener('abort', onParentAbort);
    return fetch(url, { ...init, signal: controller.signal }).finally(() => {
        clearTimeout(timer);
        parentSignal.removeEventListener('abort', onParentAbort);
    });
}
