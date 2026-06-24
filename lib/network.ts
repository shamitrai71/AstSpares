// Shipping network data for the category globe.
//
// `serviceable: true` renders green (currently shipped), false renders orange
// (planned / on request). The Mumbai HQ is the arc origin and the brand marker;
// it is exported separately and is NOT a destination.
//
// This is the build-time / static source. To make the network data-driven
// later, create a `shippingDestinations` Firestore collection with the same
// shape (public read) and read it client-side; until then this list is used.

export interface ShippingDestination {
  name: string;
  lat: number;
  lng: number;
  serviceable: boolean;
}

export const MUMBAI_HUB: ShippingDestination = { name: 'Mumbai (HQ)', lat: 19.076, lng: 72.877, serviceable: true };

export const SHIPPING_DESTINATIONS: ShippingDestination[] = [
  // ── Currently serviceable (green) ──────────────────────────────────────
  { name: 'Jamnagar', lat: 22.47, lng: 70.07, serviceable: true },
  { name: 'New Mangalore', lat: 12.92, lng: 74.80, serviceable: true },
  { name: 'Kochi (Cochin)', lat: 9.97, lng: 76.28, serviceable: true },
  { name: 'Chennai', lat: 13.08, lng: 80.27, serviceable: true },
  { name: 'Paradip', lat: 20.32, lng: 86.61, serviceable: true },
  { name: 'Haldia', lat: 22.03, lng: 88.06, serviceable: true },
  { name: 'Panipat', lat: 29.39, lng: 76.97, serviceable: true },
  { name: 'Guwahati', lat: 26.14, lng: 91.74, serviceable: true },
  { name: 'Barmer', lat: 25.75, lng: 71.39, serviceable: true },
  { name: 'Bhatinda', lat: 30.21, lng: 74.95, serviceable: true },
  { name: 'Abu Dhabi', lat: 24.45, lng: 54.38, serviceable: true },
  { name: 'Kuwait City', lat: 29.38, lng: 47.99, serviceable: true },
  { name: 'Bahrain (Manama)', lat: 26.22, lng: 50.58, serviceable: true },
  { name: 'Singapore', lat: 1.29, lng: 103.85, serviceable: true },
  { name: 'Kuala Lumpur', lat: 3.14, lng: 101.69, serviceable: true },

  // ── Planned / on request (orange) — extend toward the full 42 ──────────
  { name: 'Jebel Ali (Dubai)', lat: 25.01, lng: 55.06, serviceable: false },
  { name: 'Fujairah', lat: 25.12, lng: 56.33, serviceable: false },
  { name: 'Sohar', lat: 24.47, lng: 56.63, serviceable: false },
  { name: 'Dammam', lat: 26.43, lng: 50.10, serviceable: false },
  { name: 'Jeddah', lat: 21.49, lng: 39.19, serviceable: false },
  { name: 'Doha', lat: 25.29, lng: 51.53, serviceable: false },
  { name: 'Map Ta Phut', lat: 12.68, lng: 101.15, serviceable: false },
  { name: 'Port Klang', lat: 3.00, lng: 101.39, serviceable: false },
  { name: 'Ulsan', lat: 35.54, lng: 129.31, serviceable: false },
  { name: 'Rotterdam', lat: 51.95, lng: 4.14, serviceable: false },
  { name: 'Antwerp', lat: 51.26, lng: 4.40, serviceable: false },
  { name: 'Houston', lat: 29.76, lng: -95.37, serviceable: false },
];
