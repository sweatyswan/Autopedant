import type { NextConfig } from "next"

const isGitHubPages = process.env.GITHUB_PAGES === "true"

const basePath = isGitHubPages ? "/Autopedant" : ""

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
}

export default nextConfig
