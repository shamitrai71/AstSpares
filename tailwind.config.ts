import type { Config } from 'tailwindcss';

/**
 * ASTSPARES design tokens — the Tankonomics industrial-editorial system,
 * re-grounded for a parts catalog.
 *
 * Palette:  deep petroleum + safety orange + warm paper + graphite steel
 * Type:     Instrument Serif (display) / Geist (body) / Geist Mono (part numbers, specs)
 * Signature: the part-number plate (mono code on a steel tag with a safety-orange tick)
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        petroleum: {
          DEFAULT: '#0E1C24', // deep petroleum — primary dark surface
          ink: '#0A1419',     // near-black ink for max-contrast text on paper
          700: '#16303C',
          500: '#274A58',
          300: '#5C6B73',     // graphite steel — muted UI text
        },
        safety: {
          DEFAULT: '#E8590C', // safety orange — the single accent, used with restraint
          600: '#C9490A',
          200: '#F6C9A8',
        },
        paper: {
          DEFAULT: '#F4EFE6', // warm paper — primary light background
          200: '#EAE3D6',     // panel fill
          line: '#D8CFC0',    // hairline rule on paper
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        // Industrial: tight radii, mostly square.
        tag: '2px',
        panel: '4px',
      },
      maxWidth: {
        shell: '1180px',
      },
      letterSpacing: {
        eyebrow: '0.16em',
      },
    },
  },
  plugins: [],
};

export default config;
