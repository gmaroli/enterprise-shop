const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; token?: string | null; headers?: Record<string, string> };

function messageFrom(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const d = data as { message?: unknown; errors?: { path: string; message: string }[] };
    if (Array.isArray(d.errors) && d.errors.length > 0) {
      return d.errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join('; ');
    }
    if (typeof d.message === 'string') return d.message;
    if (Array.isArray(d.message)) return d.message.join('; ');
  }
  return fallback;
}

/** Server-side call to the REST API. Throws ApiError on non-2xx responses. */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageFrom(data, `Request failed (${res.status})`));
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
