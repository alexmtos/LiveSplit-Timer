import type { NextConfig } from "next";
import packageJson from "./package.json";

// Set by the GitHub Pages workflow: a static export served from /<repository>.
// Local builds keep the regular server so `npm start` works.
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(staticExport && {
    output: "export",
    // /timer/index.html instead of /timer.html, which every static host serves as /timer/.
    trailingSlash: true,
  }),
  basePath,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_TRAILING_SLASH: staticExport ? "1" : "0",
  },
};

export default nextConfig;
