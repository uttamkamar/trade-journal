/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class', // .dark class on <html> switches theme
  theme: {
    extend: {
      // Map all design tokens to Tailwind utility classes.
      // Colors reference CSS custom properties; dark mode is handled by
      // swapping variable values in .dark {} — no dark: variants needed.
      colors: {
        primary:        'rgb(var(--rgb-primary) / <alpha-value>)',
        'primary-hover':'rgb(var(--rgb-primary-hover) / <alpha-value>)',
        'on-primary':   'rgb(var(--rgb-on-primary) / <alpha-value>)',
        secondary:      'rgb(var(--rgb-secondary) / <alpha-value>)',
        accent:         'rgb(var(--rgb-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--rgb-accent-hover) / <alpha-value>)',
        'on-accent':    'rgb(var(--rgb-on-accent) / <alpha-value>)',
        background:     'rgb(var(--rgb-background) / <alpha-value>)',
        foreground:     'rgb(var(--rgb-foreground) / <alpha-value>)',
        card:           'rgb(var(--rgb-card) / <alpha-value>)',
        'card-fg':      'rgb(var(--rgb-card-foreground) / <alpha-value>)',
        muted:          'rgb(var(--rgb-muted) / <alpha-value>)',
        'muted-fg':     'rgb(var(--rgb-muted-fg) / <alpha-value>)',
        border:         'rgb(var(--rgb-border) / <alpha-value>)',
        profit:         'rgb(var(--rgb-profit) / <alpha-value>)',
        loss:           'rgb(var(--rgb-loss) / <alpha-value>)',
        'profit-bg':    'var(--color-profit-bg)',
        'loss-bg':      'var(--color-loss-bg)',
        ring:           'rgb(var(--rgb-ring) / <alpha-value>)',
        destructive:    'rgb(var(--rgb-destructive) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '14px',
        xl: '18px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 4px 12px rgba(15, 23, 42, 0.07)',
      },
      transitionDuration: {
        DEFAULT: '160ms',
      },
    },
  },
  plugins: [],
};
