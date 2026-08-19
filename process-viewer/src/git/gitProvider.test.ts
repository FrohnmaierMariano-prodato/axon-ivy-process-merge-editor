import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpGitProvider, WORKING_TREE } from './gitProvider';

function mockFetch(response: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      ({
        ok,
        status,
        json: async () => response
      }) as unknown as Response
    )
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpGitProvider', () => {
  it('lists tracked files', async () => {
    mockFetch({ files: ['Main.p.json', 'sub/Other.p.json'] });
    const provider = new HttpGitProvider();
    expect(await provider.listFiles()).toEqual(['Main.p.json', 'sub/Other.p.json']);
  });

  it('lists commits', async () => {
    const commits = [{ hash: 'abc', shortHash: 'abc', subject: 'x', author: 'a', date: 'd' }];
    mockFetch({ commits });
    const provider = new HttpGitProvider();
    expect(await provider.listCommits('Main.p.json')).toEqual(commits);
  });

  it('reads working tree content from the working endpoint', async () => {
    const fetchMock = vi.fn((_url: string) => Promise.resolve({ ok: true, status: 200, json: async () => ({ content: '{}' }) } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new HttpGitProvider();
    const content = await provider.readAtRef('Main.p.json', WORKING_TREE);
    expect(content).toBe('{}');
    expect(fetchMock.mock.calls[0][0]).toContain('/working?file=');
  });

  it('reads a ref via the show endpoint', async () => {
    const fetchMock = vi.fn((_url: string) => Promise.resolve({ ok: true, status: 200, json: async () => ({ content: '{}' }) } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new HttpGitProvider();
    await provider.readAtRef('Main.p.json', 'HEAD');
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain('/show?ref=HEAD');
    expect(url).toContain('file=Main.p.json');
  });

  it('throws with the server error message on failure', async () => {
    mockFetch({ error: 'boom' }, false, 500);
    const provider = new HttpGitProvider();
    await expect(provider.listFiles()).rejects.toThrow('boom');
  });

  it('lists changed files from the changes endpoint', async () => {
    const changes = [{ path: 'sub/Other.p.json', status: 'modified' }];
    const fetchMock = vi.fn((_url: string) => Promise.resolve({ ok: true, status: 200, json: async () => ({ changes }) } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new HttpGitProvider();
    expect(await provider.listChangedFiles()).toEqual(changes);
    expect(fetchMock.mock.calls[0][0]).toContain('/changes');
  });
});
