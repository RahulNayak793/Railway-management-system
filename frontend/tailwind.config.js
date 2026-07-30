/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eef6ff',
          100: '#d8ecff',
          200: '#b9daff',
          300: '#88c0fd',
          400: '#4f9df8',
          500: '#2478f2',
          600: '#0f5be8',
          700: '#0d48d6',
          800: '#103aad',
          900: '#143388',
          950: '#101f53',
        },
        navy: {
          50:  '#f0f4fa',
          100: '#d9e2f3',
          200: '#b7c9e9',
          300: '#87a4d8',
          400: '#5478c3',
          500: '#3258ac',
          600: '#244092',
          700: '#1e3378',
          800: '#1c2b62',
          900: '#1b2653',
          950: '#0d1430',
        },
        glass: {
          light: 'rgba(255,255,255,0.08)',
          medium: 'rgba(255,255,255,0.13)',
          strong: 'rgba(255,255,255,0.22)',
          border: 'rgba(255,255,255,0.15)',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-glass': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'gradient-page': 'linear-gradient(135deg, #0d1430 0%, #0f2251 40%, #14315c 70%, #0d1430 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #0d1733 0%, #0c1628 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
        'gradient-accent': 'linear-gradient(135deg, #2478f2 0%, #0f5be8 100%)',
        'gradient-success': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-warning': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'gradient-danger': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-sm': '0 4px 16px 0 rgba(31, 38, 135, 0.2)',
        'glow-blue': '0 0 20px rgba(36, 120, 242, 0.4)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.35)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.35)',
        'card': '0 4px 24px -4px rgba(0,0,0,0.4), 0 1px 4px -1px rgba(0,0,0,0.2)',
        'card-hover': '0 12px 40px -8px rgba(0,0,0,0.5), 0 4px 16px -4px rgba(36,120,242,0.15)',
        'navbar': '0 4px 30px rgba(0,0,0,0.3)',
        'inner-light': 'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in': 'slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(36,120,242,0.3)' },
          '50%': { boxShadow: '0 0 24px rgba(36,120,242,0.7)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
