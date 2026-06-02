import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Secure Vault Envelope | VaultLetter",
  description: "A private, cryptographically sealed envelope protected by Story Protocol Confidential Data Rails.",
  openGraph: {
    title: "VaultLetter — Secure Cryptographic Envelope",
    description: "A private letter has been sealed under immutable on-chain conditions. It remains locked until authorized.",
    images: [
      {
        url: "https://vaultletter.app/sealed-envelope.jpg",
        width: 1200,
        height: 630,
        alt: "VaultLetter Sealed Envelope"
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "VaultLetter — Cryptographically Sealed Envelope",
    description: "A private letter has been sealed on Story Protocol CDR. Can you unlock it?",
    images: ["https://vaultletter.app/sealed-envelope.jpg"]
  }
};

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
