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
        mist: "#F1F1EE",
        coal: "#1A1A1A",
      },
      /*
       * RN nema sintetički bold: svaka debljina je zaseban font file, pa
       * svaka debljina ima svoju klasu (font-grotesk-bold, ne font-bold).
       */
      fontFamily: {
        grotesk: ["SpaceGrotesk_400Regular"],
        "grotesk-medium": ["SpaceGrotesk_500Medium"],
        "grotesk-bold": ["SpaceGrotesk_700Bold"],
      },
    },
  },
  plugins: [],
};
