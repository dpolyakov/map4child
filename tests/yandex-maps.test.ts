import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@yandex/ymaps3-clusterer', () => ({ clusterByGrid: vi.fn() }));
vi.mock('react-dom', () => ({}));

let scripts: Array<{ onload: (() => void) | null; onerror: (() => void) | null; remove: ReturnType<typeof vi.fn> }>;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv('VITE_YANDEX_MAPS_API_KEY', 'test-key');
  scripts = [];
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('document', {
    createElement: () => ({ onload: null, onerror: null, remove: vi.fn() }),
    head: { append: (script: typeof scripts[number]) => scripts.push(script) },
  });
  vi.stubGlobal('ymaps3', undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function sdkReady() {
  vi.stubGlobal('ymaps3', {
    ready: Promise.resolve(),
    import: vi.fn().mockResolvedValue({ reactify: { bindTo: () => ({ module: () => ({}) }) } }),
  });
  scripts.at(-1)!.onload!();
}

describe('Yandex Maps loading', () => {
  it('retries the SDK after a failed request instead of caching the rejection', async () => {
    const { loadMap } = await import('../src/yandex-maps');
    const first = loadMap();
    const failed = expect(first).rejects.toThrow();
    scripts[0].onerror!();
    await failed;
    const second = loadMap();
    // Observe the rejection even when testing the old, broken implementation.
    void second.catch(() => {});
    expect(scripts).toHaveLength(2);
    sdkReady();
    await expect(second).resolves.toBeDefined();
  });

  it('reports a failed script load to the console without exposing the API key', async () => {
    const { loadMap } = await import('../src/yandex-maps');
    const failed = expect(loadMap()).rejects.toThrow();
    scripts[0].onerror!();
    await failed;
    expect(console.error).toHaveBeenCalledOnce();
    const output = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(output).toContain('SDK');
    expect(output).not.toContain('test-key');
  });

  it('shares an in-flight request and retains the successfully loaded modules', async () => {
    const { loadMap } = await import('../src/yandex-maps');
    const first = loadMap();
    expect(loadMap()).toBe(first);
    expect(scripts).toHaveLength(1);
    sdkReady();
    await expect(first).resolves.toBeDefined();
    expect(loadMap()).toBe(first);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('cleans up a timed-out script so the next attempt can load it again', async () => {
    const { loadMap } = await import('../src/yandex-maps');
    const failed = expect(loadMap()).rejects.toThrow('загрузка SDK');
    await vi.advanceTimersByTimeAsync(20_000);
    await failed;
    expect(scripts[0].remove).toHaveBeenCalledOnce();
    expect(scripts[0].onload).toBeNull();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain('20 с');
    const next = loadMap();
    expect(scripts).toHaveLength(2);
    sdkReady();
    await expect(next).resolves.toBeDefined();
  });

  it('identifies a module failure, redacts its error and reuses the loaded SDK on retry', async () => {
    const { loadMap } = await import('../src/yandex-maps');
    const failed = expect(loadMap()).rejects.toThrow('@yandex/ymaps3-reactify');
    sdkReady();
    vi.mocked(ymaps3.import).mockRejectedValueOnce(new Error('Module unavailable: ?apikey=test-key&lang=ru'));
    await failed;
    const output = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(output).toContain('Module unavailable');
    expect(output).toContain('@yandex/ymaps3-reactify');
    expect(output).not.toContain('test-key');
    await expect(loadMap()).resolves.toBeDefined();
    expect(scripts).toHaveLength(1);
  });

  it('reports a missing key before making a request', async () => {
    vi.stubEnv('VITE_YANDEX_MAPS_API_KEY', '');
    const { loadMap } = await import('../src/yandex-maps');
    await expect(loadMap()).rejects.toThrow('настройка ключа');
    expect(scripts).toHaveLength(0);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain('VITE_YANDEX_MAPS_API_KEY');
  });
});
