// Units of measure used to quantify catalogue items in RFQs and quotes.
// Stored as a short code on the product; a custom value is also allowed.

export const DEFAULT_UOM = 'EA';

/** Common units, code → readable label (shown in the picker). */
export const UOM_OPTIONS: { code: string; label: string }[] = [
  { code: 'EA', label: 'EA — each' },
  { code: 'SET', label: 'SET — set' },
  { code: 'PAIR', label: 'PAIR — pair' },
  { code: 'KG', label: 'KG — kilogram' },
  { code: 'G', label: 'G — gram' },
  { code: 'MT', label: 'MT — metric tonne' },
  { code: 'M', label: 'M — metre' },
  { code: 'CM', label: 'CM — centimetre' },
  { code: 'MM', label: 'MM — millimetre' },
  { code: 'SQM', label: 'SQM — square metre' },
  { code: 'L', label: 'L — litre' },
  { code: 'ML', label: 'ML — millilitre' },
  { code: 'ROLL', label: 'ROLL — roll' },
  { code: 'SHEET', label: 'SHEET — sheet' },
  { code: 'BOX', label: 'BOX — box' },
  { code: 'PACK', label: 'PACK — pack' },
  { code: 'DRUM', label: 'DRUM — drum' },
  { code: 'LOT', label: 'LOT — lot' },
];

export const UOM_CODES = UOM_OPTIONS.map((u) => u.code);
