// The site is served from two places: the root of cotoaleksandra.com and the
// /cotoaleksandra/ subpath on github.io. Everything links relative to this
// root so both keep working.
const marker = '/cotoaleksandra/';
const idx = location.pathname.indexOf(marker);

export const SITE_ROOT = idx === -1
  ? `${location.origin}/`
  : `${location.origin}${location.pathname.slice(0, idx + marker.length)}`;

/** Absolute URL for a path relative to the site root, e.g. path('admin/'). */
export const path = (p = '') => new URL(p.replace(/^\//, ''), SITE_ROOT).href;
