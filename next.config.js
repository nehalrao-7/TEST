/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Placeholder program art ships as local SVG. Real photography (jpg/png)
    // works without this; the flag + sandbox CSP just lets the SVG stand-ins
    // render safely until they're swapped out.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

module.exports = nextConfig;
