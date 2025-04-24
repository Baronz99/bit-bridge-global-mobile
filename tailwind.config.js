/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],

  theme: {
    extend: {
      colors: {
        primary: "#030014",
        secondary: "#030014",
        accent: "#a855f7",
          "app-primary": "#2f3b69",
          // alt: "#695d2f",
         alt: " rgb(255 204 0)",
         mtn: "#2f3b69",
         "dstv-blue": "#0071b0",
        light: {
          100: "#f3f3f3",
          200: "#A8b5db",
          300: "#9ca4ab"
        },
        dark: {
          100: "#221f3d",
          200: "#0f0d23",
          300: "#9ca4ab"
        },
        accent: "ABB8BFF"
      }
    },
  },
  plugins: [],
}

