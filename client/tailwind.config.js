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
        primary:        'var(--color-primary)',
        'primary-hover':'var(--color-primary-hover)',
        'on-primary':   'var(--color-on-primary)',
        secondary:      'var(--color-secondary)',
        accent:         'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        background:     'var(--color-background)',
        foreground:     'var(--color-foreground)',
        card:           'var(--color-card)',
        'card-fg':      'var(--color-card-foreground)',
        muted:          'var(--color-muted)',
        'muted-fg':     'var(--color-muted-fg)',
        border:         'var(--color-border)',
        profit:         'var(--color-profit)',
        loss:           'var(--color-loss)',
        'profit-bg':    'var(--color-profit-bg)',
        'loss-bg':      'var(--color-loss-bg)',
        ring:           'var(--color-ring)',
        destructive:    'var(--color-destructive)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(13,148,136,0.08), 0 1px 2px rgba(13,148,136,0.06)',
        'card-hover': '0 4px 12px rgba(13,148,136,0.12)',
      },
      transitionDuration: {
        DEFAULT: '160ms',
      },
    },
  },
  plugins: [],
};
