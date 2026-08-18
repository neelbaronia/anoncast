/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep the package external so its __dirname-based binary paths remain
    // valid, then explicitly include both executables in the function trace.
    serverComponentsExternalPackages: ['ffmpeg-ffprobe-static'],
    outputFileTracingIncludes: {
      '/api/generate': [
        './node_modules/ffmpeg-ffprobe-static/ffmpeg',
        './node_modules/ffmpeg-ffprobe-static/ffprobe',
      ],
    },
  },
};

export default nextConfig;
