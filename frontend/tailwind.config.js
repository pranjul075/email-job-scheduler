export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#00a854',
          greenHover: '#008f47',
          greenLight: '#e6f7ec',
          orange: '#f27405',
          orangeLight: '#fff5ea',
          grayBg: '#f8f9fa',
          border: '#e5e7eb',
        },
      },
    },
  },
  plugins: [],
}
