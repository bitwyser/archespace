export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      screens: {
        nav: '955px',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        bg: {
          base: 'var(--bg-base)',
          sunken: 'var(--bg-sunken)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          hover: 'var(--bg-hover)',
          border: 'var(--bg-border)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
        },
        text: {
          primary: 'var(--text-primary)',
          content: 'var(--text-content)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        success: 'var(--success)',
        danger: {
          DEFAULT: 'var(--danger)',
          hover: 'var(--danger-hover)',
          // Pre-mixed rgba (like accent-muted): Tailwind 3 cannot apply an
          // /opacity modifier to a bare var() colour, so tints need a token.
          muted: 'var(--danger-muted)',
        },
      },
    },
  },
  plugins: [],
}
