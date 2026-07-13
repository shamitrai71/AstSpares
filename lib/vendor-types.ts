import type { VendorType } from './types';

/** Vendor classifications, in display order ("Other" last). */
export const VENDOR_TYPE_OPTIONS: { code: VendorType; label: string }[] = [
  { code: 'manufacturer', label: 'Manufacturer' },
  { code: 'trader', label: 'Trader' },
  { code: 'service', label: 'Service Provider' },
  { code: 'other', label: 'Other' },
];

export const DEFAULT_VENDOR_TYPE: VendorType = 'manufacturer';

/** Readable label for a stored type code; falls back to the raw value (so
 *  legacy records like 'distributor' still display) or an em dash when empty. */
export function vendorTypeLabel(t?: string | null): string {
  return VENDOR_TYPE_OPTIONS.find((o) => o.code === t)?.label ?? (t || '—');
}
