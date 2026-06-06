// Run async tasks with a bounded concurrency. Preserves input order in the result.
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners: Promise<void>[] = [];
  const n = Math.max(1, Math.min(concurrency, items.length || 1));

  for (let k = 0; k < n; k++) {
    runners.push(
      (async () => {
        while (true) {
          if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
          const i = next++;
          if (i >= items.length) return;
          results[i] = await worker(items[i], i);
        }
      })(),
    );
  }
  await Promise.all(runners);
  return results;
}

export async function fetchJson(url: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} en ${url}`);
  }
  return res.json();
}
