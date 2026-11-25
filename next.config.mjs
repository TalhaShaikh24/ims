/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache Components disabled: every page reads live Supabase data and
  // computes totals at request time, so static prerendering does not apply.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
