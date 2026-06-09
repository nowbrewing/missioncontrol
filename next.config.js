/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@google/adk", "@google/genai", "mongodb"],
};

export default nextConfig;

