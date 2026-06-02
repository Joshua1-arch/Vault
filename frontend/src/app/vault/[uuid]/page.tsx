"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ethers } from "ethers";

interface VaultState {
  uuid: number;
  conditionType: "timelock" | "deadman" | "multisig";
  conditionParams: any;
  recipientAddress: string;
  unlocked: boolean;
  timeRemaining: number | null;
  approvals: { signer: string; approved: boolean }[];
}

export default function VaultPage() {
  const params = useParams();
  const router = useRouter();
  const uuid = params.uuid;

  const { address: activeAccount } = useAccount();

  const [vault, setVault] = useState<VaultState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Live countdown state
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number | null>(null);

  // UI Processing states
  const [isApproving, setIsApproving] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // 1. Poll condition status from backend every 3 seconds
  useEffect(() => {
    if (!uuid) return;

    async function fetchStatus() {
      try {
        const res = await fetch(`http://localhost:3001/api/check-condition/${uuid}`);
        if (!res.ok) throw new Error("Vault not found or server is offline.");
        const data = await res.json();
        setVault(data);
        setLocalTimeRemaining(data.timeRemaining);
        setError("");
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load vault details.");
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [uuid]);

  // 2. Second-by-second local countdown ticking
  useEffect(() => {
    if (localTimeRemaining === null || localTimeRemaining <= 0) return;

    const timer = setInterval(() => {
      setLocalTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [localTimeRemaining]);

  // Direct approval trigger for MultiSig
  async function handleApprove() {
    if (!vault) return;
    setIsApproving(true);
    try {
      console.log(`Approving vault ${uuid} as active signer...`);
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const multiSigAddress = process.env.NEXT_PUBLIC_MULTISIG_ADDRESS || "0x27D1238e76e984b7A03Eebc747b0e2A640a92e47";
        
        const contract = new ethers.Contract(
          multiSigAddress,
          ["function approve(uint256 vaultUuid) external"],
          signer
        );
        
        const tx = await contract.approve(BigInt(vault.uuid));
        console.log(`Approval tx submitted: ${tx.hash}`);
        await tx.wait();
        alert("On-chain approval successfully registered! Updating status...");
      } else {
        await new Promise(r => setTimeout(r, 1500));
        alert("Mock approval successful! In production, this broadcasts an on-chain transaction.");
      }
    } catch (err: any) {
      alert(`Approval failed: ${err.message || err}`);
    } finally {
      setIsApproving(false);
    }
  }

  // Direct owner check-in for DeadManSwitch
  async function handleCheckIn() {
    if (!vault) return;
    setIsCheckingIn(true);
    try {
      console.log("Broadcasting owner check-in transaction...");
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const deadmanAddress = process.env.NEXT_PUBLIC_DEADMAN_ADDRESS || "0x0f2800345705A693abEcD599db4A19E43CEC324b";
        
        const contract = new ethers.Contract(
          deadmanAddress,
          ["function checkIn() external"],
          signer
        );
        
        const tx = await contract.checkIn();
        console.log(`Check-in tx submitted: ${tx.hash}`);
        await tx.wait();
        alert("Checked in successfully! Resetting inactivity timer...");
      } else {
        await new Promise(r => setTimeout(r, 1500));
        alert("Mock check-in successful!");
      }
    } catch (err: any) {
      alert(`Check-in failed: ${err.message || err}`);
    } finally {
      setIsCheckingIn(false);
    }
  }

  function handleReveal() {
    if (vault?.unlocked || localTimeRemaining === 0) {
      router.push(`/reveal/${vault?.uuid}`);
    }
  }

  // Share link composition for X (Twitter)
  function handleShareTwitter() {
    if (!vault) return;
    
    // Compute remaining minutes dynamically
    const min = localTimeRemaining ? Math.ceil(localTimeRemaining / 60) : 2;
    const url = typeof window !== "undefined" ? window.location.href : `https://vaultletter.app/vault/${vault.uuid}`;
    const text = `I just sealed a private message into a cryptographically secured time-locked vault on @StoryProtocol. It unlocks in ${min} minutes. Can you intercept it? 🔒✉️ ${url}`;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, "_blank");
  }

  // Formatting utility for timelock countdowns (HH:MM:SS)
  function formatCountdown(sec: number) {
    if (sec <= 0) return "00:00:00";
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    return [hours, minutes, seconds].map(v => v.toString().padStart(2, "0")).join(":");
  }

  if (loading) {
    return (
      <div className="glass-card flex-center" style={{ minHeight: "350px", flexDirection: "column", gap: "15px" }}>
        <div className="wax-seal pulsing"><span style={{ fontSize: "2.2rem" }}>🔮</span></div>
        <h2>Loading Vault Status...</h2>
        <p style={{ color: "var(--text-secondary)" }}>Fetching metadata from Story CDR Rail</p>
      </div>
    );
  }

  if (error || !vault) {
    return (
      <div className="glass-card" style={{ padding: "40px", textAlign: "center" }}>
        <span style={{ fontSize: "3rem" }}>⚠️</span>
        <h2 style={{ marginTop: "15px", color: "var(--accent)" }}>Vault Not Found</h2>
        <p style={{ color: "var(--text-secondary)", margin: "15px 0" }}>
          We could not resolve vault UUID "{uuid}". Please make sure the backend server is running on port 3001.
        </p>
        <button className="btn" onClick={() => router.push("/")}>Return to Write page</button>
      </div>
    );
  }

  const { conditionType, unlocked, approvals, recipientAddress } = vault;
  const isCurrentlyUnlocked = unlocked || localTimeRemaining === 0;

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "2.5rem" }}>Secure Vault Envelope</h1>
        <p className="subtitle" style={{ fontSize: "0.95rem" }}>UUID: <span style={{ fontFamily: "monospace", color: "var(--primary)" }}>{uuid}</span></p>
      </div>

      <div className="glass-card flex-center" style={{ flexDirection: "column", gap: "25px", padding: "50px 30px", textAlign: "center" }}>
        {/* Animated Sealed Envelope Wax Seal */}
        <div 
          className={`wax-seal ${isCurrentlyUnlocked ? "unlocked" : "pulsing"}`} 
          onClick={isCurrentlyUnlocked ? handleReveal : undefined}
          style={{ width: "120px", height: "120px" }}
        >
          <span style={{ fontSize: "3.2rem" }}>{isCurrentlyUnlocked ? "🔓" : "🔒"}</span>
        </div>

        <div style={{ marginTop: "10px" }}>
          <h2 style={{ fontSize: "1.8rem", color: isCurrentlyUnlocked ? "#22c55e" : "#ff5b7f" }}>
            {isCurrentlyUnlocked ? "Vault Unlocked" : "Sealed & Encrypted"}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginTop: "5px" }}>
            Recipient Address: <span style={{ fontFamily: "monospace" }}>{recipientAddress}</span>
          </p>
        </div>

        {/* Detailed Condition-Specific Interfaces */}
        {!isCurrentlyUnlocked ? (
          <div style={{ width: "100%", borderTop: "1px solid var(--card-border)", paddingTop: "25px", marginTop: "10px" }}>
            {conditionType === "timelock" && localTimeRemaining !== null && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Countdown to Unlock (Ticks Live)
                </span>
                <span style={{ fontSize: "3rem", fontWeight: "bold", fontFamily: "monospace", color: "var(--secondary)", letterSpacing: "0.02em" }}>
                  {formatCountdown(localTimeRemaining)}
                </span>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "20px" }}>
                  This vault uses an immutable blockchain timelock. It will unlock automatically when the counter reaches zero.
                </p>

                {/* Social Share Button */}
                <div style={{ marginTop: "10px" }}>
                  <button className="btn btn-secondary" onClick={handleShareTwitter} style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "10px 20px" }}>
                    <span>🐦</span> Share Vault on X
                  </button>
                </div>
              </div>
            )}

            {conditionType === "deadman" && localTimeRemaining !== null && (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Owner Activity Remaining (Ticks Live)
                </span>
                <span style={{ fontSize: "3rem", fontWeight: "bold", fontFamily: "monospace", color: "var(--secondary)" }}>
                  {formatCountdown(localTimeRemaining)}
                </span>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "450px", margin: "0 auto" }}>
                  If the owner does not check in before this timer expires, the designated recipient can decrypt and reveal the message.
                </p>
                <div style={{ marginTop: "10px", display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button className="btn btn-secondary" onClick={handleCheckIn} disabled={isCheckingIn}>
                    {isCheckingIn ? "Checking in..." : "👋 Owner checkIn()"}
                  </button>
                  <button className="btn btn-secondary" onClick={handleShareTwitter} style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                    <span>🐦</span> Share
                  </button>
                </div>
              </div>
            )}

            {conditionType === "multisig" && approvals && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Signers Approvals Progress
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", maxWidth: "480px", margin: "0 auto", width: "100%" }}>
                  {approvals.map((app, idx) => (
                    <div key={idx} className="glass-card" style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "10px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{app.signer.slice(0, 8)}...{app.signer.slice(-6)}</span>
                      <span>{app.approved ? "✅ Approved" : "❌ Pending"}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "10px", display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button className="btn" onClick={handleApprove} disabled={isApproving}>
                    {isApproving ? "Registering approval..." : "✍️ Approve Vault Release"}
                  </button>
                  <button className="btn btn-secondary" onClick={handleShareTwitter} style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                    <span>🐦</span> Share
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ width: "100%", borderTop: "1px solid var(--card-border)", paddingTop: "25px", marginTop: "10px" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "20px", fontSize: "0.95rem" }}>
              The on-chain condition has been met! You are authorized to open the secure envelope and read the letter.
            </p>
            <button className="btn" onClick={handleReveal} style={{ padding: "16px 40px", fontSize: "1.1rem" }}>
              🔓 Reveal Decrypted Letter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
