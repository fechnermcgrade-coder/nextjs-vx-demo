import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        line: "#d8e1e8",
        brand: "#24777b",
        paper: "#f7faf9"
      }
    }
  },
  plugins: []
};

export default config;
