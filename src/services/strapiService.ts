type StrapiResponse<T> = {
  data: T;
};

type StrapiMedia = {
  data?: {
    attributes?: {
      url?: string;
    };
  } | null;
  url?: string;
} | null;

type StrapiEvent = {
  event_id: string;
  logo?: StrapiMedia;
  name?: string;
};

type StrapiItem<T> = {
  id: number | string;
  attributes?: T;
} & Partial<T>;

function getStrapiBaseUrl(): string {
  const base = process.env.REACT_APP_STRAPI_URL || '';
  return base.replace(/\/?$/, '');
}

function mediaUrl(strapiBase: string, m: any | null | undefined): string | null {
  if (!m) return null;
  const url: string | undefined = (m as any).url || (m as any)?.data?.attributes?.url;
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (!strapiBase) return null;
  return `${strapiBase}${url}`;
}

async function strapiGet(path: string): Promise<any> {
  const base = getStrapiBaseUrl();
  if (!base) return null;
  const url = `${base}${path}`;

  const controller = new AbortController();
  const timeoutMs = 5000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Strapi request failed: ${res.status} ${res.statusText} (${url})`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getEventLogoUrl(eventId: string): Promise<string | null> {
  const base = getStrapiBaseUrl();
  if (!base) return null;
  if (!eventId) return null;
  const params = new URLSearchParams();
  params.set('filters[event_id][$eqi]', eventId);
  params.set('populate[logo][populate]', '*');
  const raw = await strapiGet(`/api/events?${params.toString()}`);
  if (!raw) return null;
  const resp = raw as StrapiResponse<StrapiItem<StrapiEvent>[]>;
  const item = (resp?.data || [])[0];
  const attrs = (item as any)?.attributes || item;
  return mediaUrl(base, (attrs as any)?.logo);
}

export async function getEventLogoUrls(eventIds: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set((eventIds || []).filter(Boolean).map((s) => s.toLowerCase())));
  const results: Record<string, string> = {};

  await Promise.all(
    unique.map(async (id) => {
      try {
        const url = await getEventLogoUrl(id);
        if (url) results[id] = url;
      } catch {
        // ignore
      }
    })
  );

  return results;
}
