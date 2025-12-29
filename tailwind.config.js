
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}", 
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./store/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  // Ensure dynamic classes in constants.ts are not purged
  safelist: [
    'bg-metro-purple', 'bg-metro-darkPurple', 'text-metro-purple', 'border-metro-purple', 'from-metro-purple', 'to-metro-darkPurple',
    'bg-metro-orange', 'text-metro-orange', 'border-metro-orange', 'from-metro-orange',
    'bg-metro-blue', 'bg-metro-cobalt', 'text-metro-blue', 'border-metro-blue', 'from-metro-blue', 'to-metro-cobalt',
    'bg-metro-green', 'text-metro-green', 'bg-metro-teal', 'text-metro-teal', 'bg-metro-red', 'text-metro-red'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'Vazir', 'Segoe UI', 'Tahoma', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono", "Courier New", 'monospace'],
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
        'bg-pan': 'bgPan 40s linear infinite',
        'shine': 'shine 3s infinite linear',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg) translateZ(0)' },
          '50%': { transform: 'rotate(3deg) translateZ(0)' },
        },
        bgPan: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '100% 100%' },
        },
        shine: {
          'to': { backgroundPositionX: '-200%' }
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
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.persian-nums': {
          'font-feature-settings': '"ss01"',
          'font-variant-numeric': 'tabular-nums',
        }
      }
      addUtilities(newUtilities)
    }
  ],
}
