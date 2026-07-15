// Postal/PIN code → city + region lookup for structured vendor location.
// India uses the free, keyless India Post API; other countries use zippopotam.us.
// Runs client-side (admin form); returns null on any failure so the admin can
// still type the city/region manually.
import { COUNTRIES } from './countries';

export type PostalResult = { city: string; region: string };

export async function lookupPostal(
  countryName: string,
  code: string,
): Promise<PostalResult | null> {
  const pin = code.trim();
  if (!pin) return null;
  const iso2 = COUNTRIES.find((c) => c.name === countryName)?.iso2;
  try {
    if (iso2 === 'IN') {
      const res = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`);
      const data = await res.json();
      const po = data?.[0]?.PostOffice?.[0];
      if (!po) return null;
      return { city: po.District ?? po.Block ?? po.Name ?? '', region: po.State ?? '' };
    }
    if (iso2) {
      const res = await fetch(`https://api.zippopotam.us/${iso2.toLowerCase()}/${encodeURIComponent(pin)}`);
      if (!res.ok) return null;
      const data = await res.json();
      const place = data?.places?.[0];
      if (!place) return null;
      return { city: place['place name'] ?? '', region: place['state'] ?? '' };
    }
    return null;
  } catch {
    return null;
  }
}
