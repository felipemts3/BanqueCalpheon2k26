/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens do design system
        highlighter: '#e4f222', // --color-highlighter-yellow: única cor de destaque
        ink: '#0c0a08',         // --color-ink
        obsidian: '#1a1919',    // --color-obsidian
        paper: '#ffffff',       // --color-paper
        bone: '#f4f2f0',        // --color-bone
        ash: '#6d6c6b',         // --color-ash
        hairline: '#e5e7eb',    // --color-hairline
        smoke: '#d3d3d3',       // --color-smoke
      },
      fontFamily: {
        // "lausanne" não é gratuita: substituta Inter (peso único 400)
        lausanne: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        tag: '6px',
        card: '16px',
        input: '10px',
        button: '6px',
      },
      boxShadow: {
        subtle: 'rgba(255, 255, 255, 0.6) 0px 0px 2px 0px inset',
      },
      fontSize: {
        caption: ['10px', { lineHeight: '2.2', letterSpacing: '0.018em' }],
        body: ['16px', { lineHeight: '1.5' }],
        subheading: ['20px', { lineHeight: '1.3' }],
        'heading-sm': ['24px', { lineHeight: '1.17' }],
        heading: ['28px', { lineHeight: '1.14' }],
        'heading-lg': ['40px', { lineHeight: '1.05' }],
        display: ['64px', { lineHeight: '1' }],
      },
    },
  },
  plugins: [],
};
