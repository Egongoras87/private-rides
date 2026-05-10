/** @type {import('next').NextConfig} */
const nextConfig = {
  // Esto ayuda a que los subdominios no tengan problemas de CORS
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;