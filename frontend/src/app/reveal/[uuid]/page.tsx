"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWalletClient, usePublicClient, useAccount } from "wagmi";

export default function RevealPage() {
  const params = useParams();
  const router = useRouter();
  const uuid = params.uuid;

  // Account and Web3 details from Wagmi
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [letterContent, setLetterContent] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSender, setIsSender] = useState(false);

  useEffect(() => {
    if (!uuid) return;
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }

    // Critical: Return early if wagmi is still initializing or fetching Web3 clients
    if (!publicClient || !walletClient) {
      console.log("Waiting for browser wallet client to resolve...");
      return;
    }

    async function triggerReveal() {
      setLoading(true);
      setError("");
      setIsSender(false);
      try {
        console.log(`Verifying authorization with custodian server for UUID: ${uuid}...`);
        
        // Step 1: Validate authorization, sender lockout, and recipient alignment on server
        const res = await fetch(`http://localhost:3001/api/reveal/${uuid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callerAddress: address })
        });
        const data = await res.json();
        
        if (res.status === 403 && data.error && data.error.includes("You sealed this letter")) {
          setIsSender(true);
          setError("You sealed this letter. Its contents are beyond your reach now.");
          return;
        }

        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to authorize decryption.");
        }

        // Step 2: Perform accessCDR directly in browser using connected wallet
        console.log(`Custodian authorized. Loading secure CDR SDK in browser...`);
        const sdk = await import("@piplabs/cdr-sdk");
        await sdk.initWasm();

        if (!publicClient || !walletClient) {
          throw new Error("Browser wallet client not fully connected.");
        }

        const cdrClient = new sdk.CDRClient({
          network: "testnet",
          publicClient,
          walletClient,
          apiUrl: "http://172.192.41.96:1317"
        });

        console.log(`Popping Wallet: Approve threshold decryption on Story (1/1)...`);
        const accessResult = await cdrClient.consumer.accessCDR({
          uuid: Number(uuid),
          accessAuxData: "0x",
          timeoutMs: 60000
        });

        const decryptedLetter = new TextDecoder().decode(accessResult.dataKey);

        setLetterContent(decryptedLetter);
        setTxHash(accessResult.txHash || "");
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to decrypt vault content.");
      } finally {
        setLoading(false);
      }
    }

    triggerReveal();
  }, [uuid, isConnected, address, walletClient, publicClient]);

  if (!isConnected) {
    return (
      <div className="glass-card flex-center" style={{ minHeight: "350px", flexDirection: "column", gap: "20px", padding: "40px", textAlign: "center" }}>
        <span style={{ fontSize: "3rem" }}>🔌</span>
        <h2 style={{ fontSize: "1.6rem" }}>Wallet Disconnected</h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: "400px", marginBottom: "10px" }}>
          Please connect your wallet in the top header to reveal this letter and verify your recipient address.
        </p>
      </div>
    );
  }

  // Handle temporary visual wait state while Wagmi fetches the Web3 clients in the background
  if (!walletClient || !publicClient) {
    return (
      <div className="glass-card flex-center" style={{ minHeight: "350px", flexDirection: "column", gap: "15px" }}>
        <div className="wax-seal pulsing"><span style={{ fontSize: "2.2rem" }}>🔌</span></div>
        <h2>Initializing Secured Session...</h2>
        <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
          Connecting browser wallet client for on-chain verification...
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card flex-center" style={{ minHeight: "350px", flexDirection: "column", gap: "15px" }}>
        <div className="wax-seal pulsing"><span style={{ fontSize: "2.2rem" }}>🔑</span></div>
        <h2>Decrypting Envelope Content...</h2>
        <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
          Broadcasting reveal request to Story CDR nodes for validator threshold decryption...
        </p>
      </div>
    );
  }

  if (isSender) {
    return (
      <div className="glass-card flex-center" style={{ minHeight: "350px", flexDirection: "column", gap: "20px", textAlign: "center", border: "1px solid var(--accent)", boxShadow: "0 0 30px rgba(255, 75, 120, 0.15)" }}>
        <div className="wax-seal animate-bounce" style={{ background: "linear-gradient(135deg, #ff4b78, #a82a4d)", boxShadow: "0 0 20px rgba(255, 75, 120, 0.4)", animation: "none" }}>
          <span style={{ fontSize: "2.2rem" }}>📜</span>
        </div>
        <h2 style={{ fontSize: "1.8rem", color: "#ff4b78", fontFamily: "'Playfair Display', serif" }}>Sealed Beyond Reach</h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: "460px", lineHeight: "1.6" }}>
          You sealed this letter. Its contents are beyond your reach now. Once a message is secured in VaultLetter, the act of sealing is absolute and irreversible—even for the sender.
        </p>
        <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
          <button className="btn" onClick={() => router.push(`/vault/${uuid}`)}>Return to Countdown</button>
          <button className="btn btn-secondary" onClick={() => router.push("/")}>Compose Another Letter</button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card" style={{ padding: "40px", textAlign: "center" }}>
        <span style={{ fontSize: "3rem" }}>🔒</span>
        <h2 style={{ marginTop: "15px", color: "var(--accent)" }}>Decryption Denied</h2>
        <p style={{ color: "var(--text-secondary)", margin: "15px 0" }}>
          {error}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button className="btn" onClick={() => router.push(`/vault/${uuid}`)}>Return to Countdown</button>
          <button className="btn btn-secondary" onClick={() => router.push("/")}>Compose Letter</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      {/* Premium Materialization Keyframes */}
      <style>{`
        @keyframes letterMaterialize {
          0% {
            opacity: 0;
            transform: translateY(24px) scale(0.98);
            filter: blur(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
        .animate-materialize {
          animation: letterMaterialize 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "2.5rem" }}>✉️ Decrypted Letter</h1>
        <p className="subtitle" style={{ fontSize: "0.95rem" }}>
          Envelope UUID: <span style={{ fontFamily: "monospace", color: "var(--primary)" }}>{uuid}</span>
        </p>
      </div>

      <div className="glass-card animate-materialize" style={{ padding: "10px" }}>
        {/* Render Decrypted Plaintext Letter */}
        <div className="revealed-letter">
          {letterContent}
        </div>

        {txHash && (
          <div style={{ marginTop: "30px", padding: "15px", background: "rgba(0,0,0,0.2)", borderRadius: "10px", fontSize: "0.85rem" }}>
            <span style={{ color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Story CDR Reveal Tx Hash
            </span>
            <a 
              href={`https://aeneid.storyscan.xyz/tx/${txHash}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ fontFamily: "monospace", color: "var(--primary)", textDecoration: "none" }}
            >
              {txHash}
            </a>
          </div>
        )}

        <div style={{ marginTop: "30px", display: "flex", justifyContent: "center" }}>
          <button className="btn" onClick={() => router.push("/")}>Compose New Letter</button>
        </div>
      </div>
    </div>
  );
}
