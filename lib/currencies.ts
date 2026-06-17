// Trade currencies for a company's default currency. Stored as ISO 4217 code.
export interface Currency {
  code: string;
  label: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SAR', label: 'SAR — Saudi Riyal' },
  { code: 'QAR', label: 'QAR — Qatari Riyal' },
  { code: 'KWD', label: 'KWD — Kuwaiti Dinar' },
  { code: 'OMR', label: 'OMR — Omani Rial' },
  { code: 'BHD', label: 'BHD — Bahraini Dinar' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'EGP', label: 'EGP — Egyptian Pound' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
];

export const DEFAULT_CURRENCY = 'USD';
