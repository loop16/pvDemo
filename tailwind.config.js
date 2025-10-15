// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4F46E5",
        },
      },
      borderRadius: {
        card: "18px",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 24px 60px rgba(0,0,0,0.10), 0 6px 18px rgba(0,0,0,0.06)",
        soft: "0 6px 16px rgba(0,0,0,0.08)",
      },
      fontWeight: {
        extrablack: 950,
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
    },
  },
  plugins: [],
};

