"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

// Import RainbowKit styles
import "@rainbow-me/rainbowkit/styles.css";

// 1. Define custom chain for Story Aeneid Testnet
export const storyAeneid = defineChain({
  id: 1315,
  name: "Story Aeneid",
  nativeCurrency: {
    name: "IP Token",
    symbol: "IP",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://aeneid.storyrpc.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Storyscan",
      url: "https://aeneid.storyscan.xyz",
    },
  },
});

// 2. Configure Wagmi with SSR enabled
const config = createConfig({
  chains: [storyAeneid],
  ssr: true,
  transports: {
    [storyAeneid.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#8a7cf0", // Matching our premium primary violet
            accentColorForeground: "white",
            borderRadius: "large",
            overlayBlur: "small", // Small overlay blur for glassmorphism aesthetics
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
