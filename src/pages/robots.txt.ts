import type { APIRoute } from 'astro'
export const GET: APIRoute = () => new Response('User-agent: *\nAllow: /\nSitemap: https://yenchiu.com/yen-chiu-astro/sitemap-index.xml\n', {headers: {'Content-Type':'text/plain; charset=utf-8'}})
