/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        walnut: "#221B16",
        cream: "#F8F2E7",
        parchment: "#EFE6D4",
        brass: "#B08D57",
        "brass-bright": "#C9A56C",
        wine: "#6E2C3B",
        sage: "#5C6E52",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
