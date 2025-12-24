
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./constants.ts",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./store/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazir', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
      colors: {
        metro: {
          teal: '#00ABA9',
          green: '#00A300',
          lime: '#8CBF26',
          blue: '#2D89EF',
          purple: '#9F00A7',
          darkPurple: '#603CBA',
          red: '#EE1111',
          orange: '#F09609',
          magenta: '#FF0097',
          cobalt: '#0050EF',
          dark: '#1D1D1D',
          gray: '#555555'
        },
        m3: {
          surface: '#FDFBFF',
          surfaceVariant: '#E7E0EC',
          primary: '#2D89EF',
          onPrimary: '#FFFFFF',
          primaryContainer: '#D1E4FF',
          onPrimaryContainer: '#001D36',
        }
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)'
      },
      animation: {
        'wiggle': 'wiggle 6s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg) translateZ(0)' },
          '50%': { transform: 'rotate(3deg) translateZ(0)' },
        }
      },
      borderRadius: {
        'm3-sm': '8px',
        'm3-md': '12px',
        'm3-lg': '16px',
        'm3-xl': '28px',
        'm3-full': '9999px',
      }
    }
  },
  plugins: [],
}
