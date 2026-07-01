import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Manda o indicador de dev ("Compiling...") pro canto direito, longe da sidebar.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
