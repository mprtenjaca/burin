/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF8",
        ink: "#141414",
        night: "#0E0E0E",
        mint: "#2EE6A8",
      },
    },
  },
  plugins: [],
};
