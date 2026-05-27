import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── SquadVault design tokens ────────────────────────────────────────
      colors: {
        vault: {
          // Room colors — establish environmental depth
          bg:          '#0B0B0E',   // The Room: background
          s1:          '#141418',   // Cards, panels
          s2:          '#1D1D23',   // Elevated elements, document surfaces
          s3:          '#26262E',   // Hover states, inputs
          border:      '#2C2C34',   // Subtle borders
          rule:        '#3A3A44',   // Divider lines
          // Text
          text:        '#F0EBE1',   // Primary — warm cream, never pure white
          text2:       '#8A8478',   // Secondary — warm gray
          text3:       '#514D47',   // Muted — barely visible
          // Gold register — certification and ceremony ONLY
          gold:        '#C9A84C',   // Trophy gold — never decorative
          'gold-dim':  '#8B7035',   // Secondary gold — borders, rules
          'gold-bright': '#E8C76A', // Hover/highlight gold
          'gold-subtle': '#1E1A0F', // Gold-tinted background
          // Semantic states
          approved:    '#4A7C59',   // APPROVED state
          'approved-bg': '#0A1A10', // APPROVED background tint
          withheld:    '#8B3535',   // WITHHELD state
          'withheld-bg': '#1A0A0A', // WITHHELD background tint
          demo:        '#8B6E2A',   // DEMO artifacts — never certified
          'demo-bg':   '#1A1508',   // DEMO background tint
          attested:    '#3B7A7A',   // COMMISSIONER_ATTESTED
          'attested-bg': '#081515', // ATTESTED background tint
        },
      },

      // ── Typography ──────────────────────────────────────────────────────
      fontFamily: {
        // Cormorant Garamond: ceremonial display text only
        // Founding plaque, trophy names, season headers, artifact titles
        ceremonial: ['var(--font-ceremonial)', 'Georgia', 'serif'],
        // Outfit: all interface chrome, body text, labels, navigation
        ui: ['var(--font-ui)', 'system-ui', 'sans-serif'],
        // DM Mono: trust bars, docket IDs, state labels — the record's typeface
        mono: ['var(--font-mono)', 'Courier New', 'monospace'],
      },

      fontSize: {
        // Ceremonial scale
        'plaque': ['3.5rem', { lineHeight: '1.1', letterSpacing: '0.04em' }],
        'display': ['2.5rem', { lineHeight: '1.15', letterSpacing: '0.04em' }],
        'season': ['2rem', { lineHeight: '1.2', letterSpacing: '0.04em' }],
        'chapter': ['1.5rem', { lineHeight: '1.3', letterSpacing: '0.04em' }],
        // UI scale
        'ui-xl': ['1.125rem', { lineHeight: '1.5' }],
        'ui-lg': ['1rem', { lineHeight: '1.6' }],
        'ui-base': ['0.875rem', { lineHeight: '1.6' }],
        'ui-sm': ['0.75rem', { lineHeight: '1.5' }],
        'ui-xs': ['0.6875rem', { lineHeight: '1.4' }],
        // Mono scale
        'mono-base': ['0.8125rem', { lineHeight: '1.5', letterSpacing: '0.08em' }],
        'mono-sm': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.1em' }],
        'mono-xs': ['0.625rem', { lineHeight: '1.4', letterSpacing: '0.15em' }],
      },

      // ── Spacing ─────────────────────────────────────────────────────────
      borderRadius: {
        // Deliberately restrained — the Clubhouse is institutional, not bubbly
        'vault': '4px',
        'vault-lg': '6px',
        'vault-card': '8px',
      },

      // ── Shadows ─────────────────────────────────────────────────────────
      boxShadow: {
        // No decorative shadows — only gold glow for ceremony moments
        'gold-glow': '0 0 20px rgba(201, 168, 76, 0.2)',
        'gold-glow-sm': '0 0 10px rgba(201, 168, 76, 0.15)',
        'approved-glow': '0 0 16px rgba(74, 124, 89, 0.2)',
      },

      // ── Animations ──────────────────────────────────────────────────────
      keyframes: {
        // The approval stamp — weighted, physical
        stampIn: {
          'from':  { transform: 'scale(1.5) rotate(-12deg)', opacity: '0' },
          '60%':   { transform: 'scale(0.93) rotate(1.5deg)', opacity: '1' },
          'to':    { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        // Archive entries appearing — like records being laid down
        fadeUp: {
          'from': { opacity: '0', transform: 'translateY(12px)' },
          'to':   { opacity: '1', transform: 'translateY(0)' },
        },
        // Trust bar upgrading from draft to certified
        trustReveal: {
          'from': { opacity: '0', letterSpacing: '0.4em' },
          'to':   { opacity: '1', letterSpacing: '0.15em' },
        },
        // Founding plaque engraving
        engrave: {
          'from': { opacity: '0', letterSpacing: '0.5em' },
          'to':   { opacity: '1', letterSpacing: '0.04em' },
        },
        // Gold rule drawing from center outward
        drawRule: {
          'from': { width: '0', opacity: '0' },
          'to':   { width: '40px', opacity: '1' },
        },
        // Vault door dial rotation (Locked Room)
        dialSpin: {
          'from': { transform: 'rotate(0deg)' },
          'to':   { transform: 'rotate(360deg)' },
        },
        // Trophy shimmer on hover
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        // First approval: full-page flash
        pageFlash: {
          '0%':   { opacity: '0' },
          '30%':  { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'stamp-in':    'stampIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'stamp-slow':  'stampIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fade-up':     'fadeUp 0.3s ease forwards',
        'trust-reveal': 'trustReveal 0.4s ease 0.3s forwards',
        'engrave':     'engrave 0.8s ease forwards',
        'draw-rule':   'drawRule 0.3s ease 0.6s forwards',
        'dial-spin':   'dialSpin 60s linear infinite',
        'page-flash':  'pageFlash 0.4s ease forwards',
      },

      // ── Transitions ─────────────────────────────────────────────────────
      transitionTimingFunction: {
        'vault': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
