/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // AWS Amplify用の設定
  images: {
    unoptimized: true,
  },
  // 環境変数をクライアント側で利用可能にする
  env: {
    NEXT_PUBLIC_ETHEREUM_RPC: process.env.NEXT_PUBLIC_ETHEREUM_RPC || 'https://eth.llamarpc.com',
    NEXT_PUBLIC_POLYGON_RPC: process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://polygon-rpc.com',
    NEXT_PUBLIC_AVALANCHE_RPC: process.env.NEXT_PUBLIC_AVALANCHE_RPC || 'https://1rpc.io/avax/c',
  },
}

module.exports = nextConfig

