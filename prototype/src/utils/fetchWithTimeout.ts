export function fetchWithTimeout(url: string, parentSignal: AbortSignal, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onParentAbort = () => controller.abort();
    parentSignal.addEventListener('abort', onParentAbort);
    return fetch(url, { signal: controller.signal }).finally(() => {
        clearTimeout(timer);
        parentSignal.removeEventListener('abort', onParentAbort);
    });
}
