import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ASTSPARES — Tank & Terminal Spares',
    short_name: 'ASTSPARES',
    description:
      'Part-number catalogue and RFQ platform for storage-tank and terminal spares.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4EFE6',
    theme_color: '#0E1C24',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
