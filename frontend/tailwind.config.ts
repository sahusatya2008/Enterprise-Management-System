import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#07111d",
        slatepanel: "#0e1c30",
        primary: "#5eead4",
        accent: "#f59e0b",
        rosepanel: "#fb7185"
      },
      boxShadow: {
        ambient: "0 30px 90px rgba(4, 12, 24, 0.55)"
      },
      backgroundImage: {
        aurora:
          "radial-gradient(circle at 10% 12%, rgba(94, 234, 212, 0.22), transparent 26%), radial-gradient(circle at 85% 18%, rgba(245, 158, 11, 0.16), transparent 18%), linear-gradient(135deg, rgba(8, 17, 31, 0.96), rgba(7, 18, 36, 0.98))"
      }
    }
  },
  plugins: []
};

export default config;

