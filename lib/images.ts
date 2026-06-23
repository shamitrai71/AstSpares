// Cloudinary delivery-URL optimizer.
//
// Catalog images render at a fixed 4:3 box with object-cover, so a raw
// full-resolution Cloudinary URL is both oversized and liable to crop
// unpredictably. This injects a sensible default transformation right after
// `/upload/` — fill-crop to 4:3, cap width at 1200px, and serve a modern
// format at auto quality — matching the layout and cutting payload to ~tens of KB.
//
// Idempotent and safe: URLs that already carry a transformation, are signed,
// or aren't Cloudinary image-delivery URLs are returned unchanged.

const DEFAULT_TX = 'c_fill,ar_4:3,w_1200,f_auto,q_auto';

// A first path segment after /upload/ that starts with one of these param
// prefixes indicates a transformation is already present.
const TX_PARAM = /(^|,)(a_|ar_|b_|bo_|c_|co_|dpr_|e_|f_|fl_|g_|h_|l_|o_|q_|r_|t_|u_|w_|x_|y_|z_)/;

export function optimizeCloudinaryUrl(url: string, tx: string = DEFAULT_TX): string {
  if (!url) return url;
  const clean = url.trim();
  if (!clean.includes('res.cloudinary.com')) return clean; // not Cloudinary

  const marker = '/upload/';
  const at = clean.indexOf(marker);
  if (at === -1) return clean; // not an image-delivery URL

  const head = clean.slice(0, at + marker.length);
  const rest = clean.slice(at + marker.length);
  const firstSeg = rest.split('/')[0] ?? '';

  if (firstSeg.startsWith('s--')) return clean; // signed URL — don't touch
  if (TX_PARAM.test(firstSeg)) return clean;     // already transformed

  return head + tx + '/' + rest;
}
