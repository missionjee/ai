/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // HIROTO AI AMOLED Design System
        amoled: '#000000',
        surface: {
          elevated: '#0d1117',
          sunken: '#05070a',
          card: '#0a0d14',
        },
        border: {
          outer: '#1e293b',
          subtle: '#1e2532',
          highlight: '#475569',
        },
        gold: {
          DEFAULT: '#f59e0b',
          dark: '#b45309',
          glow: 'rgba(245,179,53,0.25)',
        },
        emerald: {
          win: '#10b981',
          dark: '#047857',
        },
        ruby: {
          loss: '#e11d48',
          dark: '#9f1239',
        },
        sapphire: '#3b82f6',
      },
      fontFamily: {
        main: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Space Grotesk', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-dot': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-in',
        'toast-in': 'toastIn 0.3s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        toastIn: {
          '0%': { transform: 'translateX(-50%) translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateX(-50%) translateY(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'card': '0 20px 50px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)',
        'button': '0 4px 14px rgba(245,158,11,0.3)',
        'sniper': '0 0 20px rgba(0,230,118,0.2)',
      },
    },
  },
  plugins: [],
}
