const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  sassOptions: {
    includePaths: [path.join(__dirname, 'src')],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
    NEXT_PUBLIC_DOCUMENT_API_URL:
      process.env.NEXT_PUBLIC_DOCUMENT_API_URL || 'http://localhost:8006/api/v1',
  },
};

module.exports = nextConfig;
