import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef2fa",
          100: "#d7e0f2",
          200: "#aebfe4",
          300: "#7f9bd4",
          400: "#4d70b8",
          500: "#2f4f96",
          600: "#1f3872",
          700: "#152a5a",
          800: "#0f1f44",
          900: "#0a1631",
        },
        orange: {
          50: "#fff4ed",
          100: "#ffe4d2",
          200: "#ffc4a3",
          300: "#ff9c6b",
          400: "#ff7a3d",
          500: "#f4611c",
          600: "#d94e12",
          700: "#b33d10",
          800: "#8f3212",
          900: "#752b12",
        },
      },
    },
  },
  plugins: [],
};

export default config;
