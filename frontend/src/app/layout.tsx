import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export const metadata: Metadata = {
  title: "VaultLetter | Confidential Time-Locked Message Vaults",
  description: "Securely seal private messages with on-chain cryptographic rules using Story Protocol Confidential Data Rails. Unlock via Timelock, Dead-Man Switch, or Multi-Sig consensus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="container">
            <header className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <a href="/" className="logo" style={{ textDecoration: "none" }}>
                VaultLetter
              </a>
              
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                {/* Minimal ConnectButton: hides balance, shows only chain icon */}
                <ConnectButton 
                  showBalance={false}
                  chainStatus="icon"
                />
                
                <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  Powered by <span style={{ color: "var(--primary)", fontWeight: 600 }}>Story CDR</span>
                </div>
              </div>
            </header>
            
            <main>{children}</main>

            <footer className="footer">
              <p>© {new Date().getFullYear()} VaultLetter. Built for the Story Protocol CDR Hackathon.</p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
