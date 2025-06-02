/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Fix for development chunk loading issues
  experimental: {
    optimizePackageImports: ['@headlessui/react', 'lucide-react'],
  },
  // Expose environment variables
  env: {
    COURTLISTENER_API_KEY: process.env.COURTLISTENER_API_KEY,
  },
  // Improve development stability
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 60 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
  },
  images: {
    remotePatterns: [
      {
        hostname: 's2.googleusercontent.com',
      },
    ],
  },
  serverExternalPackages: ['pdf-parse'],
  webpack: (config, { isServer, dev }) => {
    // Fix for Supabase eval issue
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        canvas: false,
        encoding: false,
        zlib: false,
        util: false,
        assert: false,
        stream: false,
        crypto: false,
      };
    }

    // Development optimizations to prevent chunk loading issues
    if (dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            default: {
              ...config.optimization.splitChunks?.cacheGroups?.default,
              minChunks: 1,
            },
          },
        },
      };
    }

    // PDF.js configuration for react-pdf
    if (!isServer) {
      // Exclude problematic Node.js modules from browser bundle
      config.externals = config.externals || [];
      config.externals.push({
        'canvas': 'canvas',
        'jsdom': 'jsdom',
      });

      // Ignore canvas.node and other binary files
      config.module.rules.push({
        test: /\.node$/,
        use: 'ignore-loader',
      });
    }

    return config;
  },
};

export default nextConfig;
