import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Mongoose ships optional native drivers Next should not try to bundle.
  serverExternalPackages: ['mongoose'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.public.blob.vercel-storage.com' }],
  },
}

export default nextConfig
