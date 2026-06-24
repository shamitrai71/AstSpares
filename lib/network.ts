// Shipping network data for the category globe.
//
// `serviceable: true` renders green (currently shipped), false renders orange
// (planned / on request). Mumbai is the arc origin + brand marker (passed as
// `hub` by NetworkGlobe), so it is NOT a destination here.
//
// This is the static source (matches the original 42-city set). To manage it
// without a rebuild later, create a `shippingDestinations` Firestore collection
// with this shape (public read) and read it client-side instead.

export interface ShippingDestination {
  name: string;
  lat: number;
  lng: number;
  serviceable: boolean;
}

export const SHIPPING_DESTINATIONS: ShippingDestination[] = [
  // ── Currently serviceable (green) ──────────────────────────────────────
  { name: 'Abu Dhabi', lat: 24.45, lng: 54.38, serviceable: true },
  { name: 'Kuwait', lat: 29.38, lng: 47.99, serviceable: true },
  { name: 'Bahrain', lat: 26.23, lng: 50.58, serviceable: true },
  { name: 'Singapore', lat: 1.35, lng: 103.82, serviceable: true },
  { name: 'Kuala Lumpur', lat: 3.14, lng: 101.69, serviceable: true },
  { name: 'Jamnagar', lat: 22.47, lng: 70.06, serviceable: true },
  { name: 'Mangalore', lat: 12.91, lng: 74.86, serviceable: true },
  { name: 'Cochin', lat: 9.93, lng: 76.27, serviceable: true },
  { name: 'Chennai', lat: 13.08, lng: 80.27, serviceable: true },
  { name: 'Paradip', lat: 20.32, lng: 86.61, serviceable: true },
  { name: 'Haldia', lat: 22.07, lng: 88.07, serviceable: true },
  { name: 'Panipat', lat: 29.39, lng: 76.97, serviceable: true },
  { name: 'Guwahati', lat: 26.14, lng: 91.74, serviceable: true },
  { name: 'Barmer', lat: 25.75, lng: 71.39, serviceable: true },
  { name: 'Bhatinda', lat: 30.21, lng: 74.95, serviceable: true },

  // ── Planned / on request (orange) ──────────────────────────────────────
  { name: 'Rotterdam', lat: 51.92, lng: 4.48, serviceable: false },
  { name: 'Antwerp', lat: 51.22, lng: 4.40, serviceable: false },
  { name: 'Karlsruhe', lat: 49.01, lng: 8.40, serviceable: false },
  { name: 'Plock', lat: 52.55, lng: 19.71, serviceable: false },
  { name: 'Palermo', lat: 38.12, lng: 13.36, serviceable: false },
  { name: 'Hampshire', lat: 50.95, lng: -1.36, serviceable: false },
  { name: 'Riyadh', lat: 24.71, lng: 46.68, serviceable: false },
  { name: 'Qatar', lat: 25.29, lng: 51.53, serviceable: false },
  { name: 'Cairo', lat: 30.04, lng: 31.24, serviceable: false },
  { name: 'Tripoli', lat: 32.89, lng: 13.19, serviceable: false },
  { name: 'Algiers', lat: 36.75, lng: 3.06, serviceable: false },
  { name: 'Abuja', lat: 9.06, lng: 7.50, serviceable: false },
  { name: 'Luanda', lat: -8.84, lng: 13.23, serviceable: false },
  { name: 'Istanbul', lat: 41.01, lng: 28.98, serviceable: false },
  { name: 'Shymkent', lat: 42.32, lng: 69.59, serviceable: false },
  { name: 'Moscow', lat: 55.76, lng: 37.62, serviceable: false },
  { name: 'Houston', lat: 29.76, lng: -95.37, serviceable: false },
  { name: 'Baton Rouge', lat: 30.45, lng: -91.19, serviceable: false },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24, serviceable: false },
  { name: 'Caracas', lat: 10.49, lng: -66.90, serviceable: false },
  { name: 'Rio de Janeiro', lat: -22.91, lng: -43.17, serviceable: false },
  { name: 'Buenos Aires', lat: -34.61, lng: -58.38, serviceable: false },
  { name: 'Manila', lat: 14.60, lng: 120.98, serviceable: false },
  { name: 'Brisbane', lat: -27.47, lng: 153.03, serviceable: false },
  { name: 'Dhaka', lat: 23.81, lng: 90.41, serviceable: false },
  { name: 'Ho Chi Minh', lat: 10.82, lng: 106.63, serviceable: false },
  { name: 'Bangkok', lat: 13.76, lng: 100.50, serviceable: false },
];
