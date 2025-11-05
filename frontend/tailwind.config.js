// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}", // Ensure it covers ComparisonPage.jsx if it's in the root
  ],
  // Enable dark mode based on the 'class' attribute
  darkMode: 'class', 
  theme: {
    extend: {
      animation: {
        // Define the custom animation utility
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        // Define the keyframes for the smooth fade-in-up animation
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      // Configure typography for dark mode
      typography: (theme) => ({
        DEFAULT: {
          css: {
            // General prose settings for light mode (if needed)
            '--tw-prose-body': theme('colors.gray.700'),
            '--tw-prose-headings': theme('colors.gray.900'),
            // ... other light mode colors
          },
        },
        // Custom class for dark mode within the prose content
        'dark-mode-prose': {
          css: {
            '--tw-prose-body': theme('colors.gray.300'),
            '--tw-prose-headings': theme('colors.white'),
            // Force strong/bold to look good in dark mode
            'strong': {
              color: theme('colors.white'),
            },
            // Ensure links/custom colors also respect dark mode (though we mostly use custom utilities)
            'a': {
              color: theme('colors.purple.400'),
              '&:hover': {
                color: theme('colors.purple.300'),
              },
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};