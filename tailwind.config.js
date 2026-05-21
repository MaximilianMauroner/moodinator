/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["serif"],
        body: ["sans-serif"],
        mono: ["monospace"],
      },
      colors: {
        // Soft Organic palette - warm, natural, cozy
        paper: {
          50: "#FDFCFA",
          100: "#FAF8F4",
          200: "#F5F1E8",
          300: "#EDE7DA",
          400: "#DDD4C4",
          // Dark mode variants: clean eucalyptus ink with lifted green paper layers.
          800: "#182C20",
          850: "#14251C",
          900: "#08150F",
          950: "#09130E",
        },
        sage: {
          50: "#F4F7F4",
          100: "#E8EFE8",
          200: "#D1DFD1",
          300: "#A8C5A8",
          400: "#7BA87B",
          500: "#5B8A5B",
          600: "#476D47",
        },
        coral: {
          50: "#FEF6F4",
          100: "#FDE8E4",
          200: "#FACFC7",
          300: "#F5A899",
          400: "#ED8370",
          500: "#E06B55",
          600: "#C75441",
        },
        sand: {
          50: "#FDFBF7",
          100: "#F9F5ED",
          200: "#F2EBD9",
          300: "#E5D9BF",
          400: "#D4C4A0",
          500: "#BDA77D",
          600: "#9D8660",
          // Dark variants
          800: "#342B1D",
          900: "#241E15",
        },
        dusk: {
          50: "#F8F7F9",
          100: "#EFECF2",
          200: "#DDD8E5",
          300: "#C4BBCF",
          400: "#A396B3",
          500: "#847596",
          600: "#695C78",
          // Dark mode
          700: "#51485F",
          800: "#332D3D",
          900: "#24212D",
        },
        // Mood spectrum - more organic, less saturated
        mood: {
          great: "#5B8A5B",      // Sage green
          good: "#7BA87B",       // Light sage
          okay: "#A8C5A8",       // Pale sage
          neutral: "#9D8660",    // Warm sand
          low: "#D4A574",        // Warm amber
          struggling: "#E08B5A", // Soft coral orange
          difficult: "#E06B55", // Coral
          crisis: "#C75441",    // Deep coral
        },
      },
    },
  },
  plugins: [],
};
