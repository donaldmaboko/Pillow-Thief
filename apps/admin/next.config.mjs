/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared domain package is a local file: dependency (see .npmrc). It ships
  // TypeScript sources, so Next must transpile it.
  transpilePackages: ['@pillow-thief/shared'],
}

export default nextConfig
