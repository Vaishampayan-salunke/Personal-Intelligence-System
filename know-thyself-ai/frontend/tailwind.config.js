/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          violet: "#6366f1",
          deepViolet: "#4f46e5",
          purple: "#9333ea",
          softPurple: "#a855f7",
          blue: "#2563eb",
          electricBlue: "#3b82f6",
          teal: "#0d9488",
          lightTeal: "#14b8a6",
          coral: "#ea580c",
          coralOrange: "#f97316",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'card': '0 4px 20px -2px rgba(99, 102, 241, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        'glow-violet': '0 0 25px -5px rgba(99, 102, 241, 0.3)',
        'glow-teal': '0 0 25px -5px rgba(20, 184, 166, 0.3)',
      }
    },
  },
  plugins: [],
}
