export const BASE_URL = "https://tirur-connect-main.onrender.com/api";

export async function getNews(params = {}) {
  const url = new URL(`${BASE_URL}/news`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const resp = await fetch(url);
  return resp.json();
}

export async function getNewsBySlug(slug) {
  const resp = await fetch(`${BASE_URL}/news/${encodeURIComponent(slug)}`);
  return resp.json();
}

export async function searchNews(query) {
  return getNews({ search: query });
}
