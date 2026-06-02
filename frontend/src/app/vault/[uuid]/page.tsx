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
  senderAddress?: string;
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

  // Custom Toast System state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  function triggerToast(message: string, type: "success" | "error" | "info") {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }

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

  // Direct approval trigger for MultiSig (Executed entirely by client wallet)
  async function handleApprove() {
    if (!vault) return;
    setIsApproving(true);
    triggerToast("Broadcasting approval transaction on-chain...", "info");
    try {
      console.log(`Approving vault ${uuid} as active signer...`);
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        
        const multiSigAddress = process.env.NEXT_PUBLIC_MULTISIG_ADDRESS || "0xbaa6a2d58487a4363b01ff65f3d09a521147f0f7";
        
        const contract = new ethers.Contract(
          multiSigAddress,
          ["function approve(uint256 vaultUuid) external"],
          signer
        );
        
        const tx = await contract.approve(BigInt(vault.uuid));
        console.log(`Approval tx submitted: ${tx.hash}`);
        await tx.wait();
        triggerToast("Approval successfully registered on Story Protocol!", "success");
      } else {
        await new Promise(r => setTimeout(r, 1500));
        triggerToast("Wallet provider not found. Please connect Metamask.", "error");
      }
    } catch (err: any) {
      triggerToast(`Approval failed: ${err.message || err}`, "error");
    } finally {
      setIsApproving(false);
    }
  }

  // Direct owner check-in for DeadManSwitch (Executed entirely by owner wallet)
  async function handleCheckIn() {
    if (!vault) return;
    setIsCheckingIn(true);
    triggerToast("Broadcasting owner check-in on-chain...", "info");
    try {
      console.log("Broadcasting owner check-in transaction...");
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        
        const deadmanAddress = process.env.NEXT_PUBLIC_DEADMAN_ADDRESS || "0x9a736dd318d09ccc87cb4ed5f6528a13ed5ba692";
        
        const contract = new ethers.Contract(
          deadmanAddress,
          ["function checkIn() external"],
          signer
        );
        
        const tx = await contract.checkIn();
        console.log(`Check-in tx submitted: ${tx.hash}`);
        await tx.wait();
        triggerToast("Inactivity lock successfully maintained!", "success");
      } else {
        await new Promise(r => setTimeout(r, 1500));
        triggerToast("Wallet provider not found. Please connect Metamask.", "error");
      }
    } catch (err: any) {
      triggerToast(`Confirmation failed: ${err.message || err}`, "error");
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
    
    const min = localTimeRemaining ? Math.ceil(localTimeRemaining / 60) : 2;
    const url = typeof window !== "undefined" ? window.location.href : `https://vaultletter.app/vault/${vault.uuid}`;
    const text = `I just sealed a private message into a cryptographically secured time-locked vault on @StoryProtocol. It unlocks in ${min} minutes. Can you intercept it? ${url}`;
    
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
        <div className="wax-seal pulsing" style={{ width: "90px", height: "90px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#ffffff" }}>
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
        </div>
        <h2>Loading Vault Status...</h2>
        <p style={{ color: "var(--text-secondary)" }}>Fetching metadata from Story CDR Rail</p>
      </div>
    );
  }

  if (error || !vault) {
    return (
      <div className="glass-card" style={{ padding: "40px", textAlign: "center" }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)", marginBottom: "15px" }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <h2 style={{ color: "var(--accent)" }}>Vault Not Found</h2>
        <p style={{ color: "var(--text-secondary)", margin: "15px 0" }}>
          We could not resolve vault UUID "{uuid}". Please make sure the backend server is running on port 3001.
        </p>
        <button className="btn" onClick={() => router.push("/")}>Return to Write page</button>
      </div>
    );
  }

  const { conditionType, unlocked, approvals, recipientAddress, senderAddress } = vault;
  const isCurrentlyUnlocked = unlocked || (localTimeRemaining !== null && localTimeRemaining === 0);

  // Address identity checks for contextual customizations
  const isRecipient = activeAccount && recipientAddress && activeAccount.toLowerCase() === recipientAddress.toLowerCase();
  const isSender = activeAccount && senderAddress && activeAccount.toLowerCase() === senderAddress.toLowerCase();

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
          style={{ width: "120px", height: "120px", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {isCurrentlyUnlocked ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#ffffff" }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
            </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#ffffff" }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          )}
        </div>

        <div style={{ marginTop: "10px", width: "100%" }}>
          <h2 style={{ fontSize: "1.8rem", color: isCurrentlyUnlocked ? "#22c55e" : "#ff5b7f" }}>
            {isCurrentlyUnlocked ? "Vault Unlocked" : "Sealed & Encrypted"}
          </h2>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
            <span style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Recipient Address: <span style={{ fontFamily: "monospace" }}>{recipientAddress.slice(0, 8)}...{recipientAddress.slice(-6)}</span>
            </span>
            {isRecipient && (
              <span style={{ 
                padding: "4px 10px", 
                borderRadius: "20px", 
                background: "rgba(34, 197, 94, 0.12)", 
                border: "1px solid rgba(34, 197, 94, 0.4)", 
                color: "#22c55e", 
                fontSize: "0.78rem", 
                fontWeight: 600,
                letterSpacing: "0.02em"
              }}>
                Recipient (You)
              </span>
            )}
            {isSender && (
              <span style={{ 
                padding: "4px 10px", 
                borderRadius: "20px", 
                background: "rgba(124, 58, 237, 0.12)", 
                border: "1px solid rgba(124, 58, 237, 0.4)", 
                color: "#c084fc", 
                fontSize: "0.78rem", 
                fontWeight: 600,
                letterSpacing: "0.02em"
              }}>
                Sender (You)
              </span>
            )}
          </div>
        </div>

        {/* Detailed Condition-Specific Interfaces */}
        {!isCurrentlyUnlocked ? (
          <div style={{ width: "100%", borderTop: "1px solid var(--card-border)", paddingTop: "25px", marginTop: "10px" }}>
            {conditionType === "timelock" && localTimeRemaining !== null && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Countdown to Unlock
                </span>
                <span style={{ fontSize: "3rem", fontWeight: "bold", fontFamily: "monospace", color: "var(--secondary)", letterSpacing: "0.02em" }}>
                  {formatCountdown(localTimeRemaining)}
                </span>
                
                {/* Context-aware Copy for Timelock */}
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "20px", maxWidth: "520px", margin: "0 auto 20px" }}>
                  {isRecipient 
                    ? "You are the authorized recipient. The blockchain lock is keeping the envelope securely sealed until the timer reaches zero." 
                    : isSender 
                      ? "You sealed this envelope under an immutable blockchain timelock. You cannot read or retract it; only the recipient can decrypt it once the countdown expires."
                      : "This vault uses an immutable blockchain timelock. It will unlock automatically when the counter reaches zero."
                  }
                </p>

                {/* Social Share Button */}
                <div style={{ marginTop: "10px" }}>
                  <button className="btn btn-secondary flex-center" onClick={handleShareTwitter} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 20px", margin: "0 auto" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#ffffff" }}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                    </svg>
                    Share Vault on X
                  </button>
                </div>
              </div>
            )}

            {conditionType === "deadman" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Inactivity Timer
                </span>
                {localTimeRemaining === null ? (
                  <span style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#f59e0b", padding: "10px 0" }}>
                    Switch Inactive - Awaiting Activation
                  </span>
                ) : (
                  <span style={{ fontSize: "3rem", fontWeight: "bold", fontFamily: "monospace", color: "var(--secondary)" }}>
                    {formatCountdown(localTimeRemaining)}
                  </span>
                )}
                
                {/* Context-aware Copy for Dead-Man */}
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "500px", margin: "0 auto", lineHeight: "1.5" }}>
                  {localTimeRemaining === null 
                    ? isSender 
                      ? "Welcome back, Owner. Activate the cryptographic switch below to start the countdown."
                      : "Awaiting activation from the owner to start the lock countdown."
                    : isSender 
                      ? "Owner: Reset timer below before expiration to maintain cryptographic security."
                      : isRecipient 
                        ? "Recipient: Once the activity timer expires, you will be authorized to unlock and decrypt the envelope."
                        : "If owner activity ceases for this duration, the designated recipient can decrypt and reveal the message."
                  }
                </p>
                
                <div style={{ marginTop: "10px", display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button className="btn" onClick={handleCheckIn} disabled={isCheckingIn}>
                    {isCheckingIn ? "Processing..." : localTimeRemaining === null ? "Initiate Cryptographic Lock" : "Maintain Lock"}
                  </button>
                  <button className="btn btn-secondary flex-center" onClick={handleShareTwitter} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#ffffff" }}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                    </svg>
                    Share
                  </button>
                </div>
              </div>
            )}

            {conditionType === "multisig" && approvals && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Signers Approvals Progress
                </span>
                
                {/* Context-aware Copy for Multi-Sig */}
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "500px", margin: "0 auto" }}>
                  {isRecipient 
                    ? "You are the recipient. Once the required number of on-chain approvals is reached, you will be authorized to decrypt and read the letter."
                    : "Unlocks only when M-of-N configured signers submit their transaction approvals on-chain directly to the Multi-Sig contract."
                  }
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", maxWidth: "480px", margin: "0 auto", width: "100%" }}>
                  {approvals.map((app, idx) => {
                    const isUserSigner = activeAccount && app.signer && activeAccount.toLowerCase() === app.signer.toLowerCase();
                    return (
                      <div key={idx} className="glass-card" style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{app.signer.slice(0, 8)}...{app.signer.slice(-6)}</span>
                          {isUserSigner && (
                            <span style={{ fontSize: "0.72rem", color: "var(--primary)", background: "rgba(124, 58, 237, 0.12)", border: "1px solid rgba(124, 58, 237, 0.3)", padding: "2px 6px", borderRadius: "12px", fontWeight: 600 }}>
                              You
                            </span>
                          )}
                        </div>
                        <span style={{ 
                          color: app.approved ? "#22c55e" : "#ff5b7f", 
                          background: app.approved ? "rgba(34, 197, 94, 0.1)" : "rgba(255, 91, 127, 0.1)",
                          border: app.approved ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(255, 91, 127, 0.3)",
                          padding: "4px 10px",
                          borderRadius: "14px",
                          fontSize: "0.8rem",
                          fontWeight: 600 
                        }}>
                          {app.approved ? "Approved" : "Pending"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: "10px", display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button className="btn flex-center" onClick={handleApprove} disabled={isApproving} style={{ gap: "8px" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#ffffff" }}>
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                    </svg>
                    Approve Vault Release
                  </button>
                  <button className="btn btn-secondary flex-center" onClick={handleShareTwitter} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#ffffff" }}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                    </svg>
                    Share
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ width: "100%", borderTop: "1px solid var(--card-border)", paddingTop: "25px", marginTop: "10px" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "20px", fontSize: "0.95rem" }}>
              {isRecipient 
                ? "The on-chain condition has been met! You are authorized to open the secure envelope and read the letter."
                : "The on-chain condition has been met! The authorized recipient can now open this envelope."
              }
            </p>
            {isRecipient ? (
              <button className="btn flex-center" onClick={handleReveal} style={{ padding: "16px 40px", fontSize: "1.1rem", gap: "10px", margin: "0 auto" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#ffffff" }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                </svg>
                Reveal Decrypted Letter
              </button>
            ) : (
              <p style={{ color: "var(--accent)", fontSize: "0.9rem", fontWeight: 600 }}>
                * Awaiting Recipient Wallet Connection to Decrypt
              </p>
            )}
          </div>
        )}
      </div>

      {/* Reusable Premium Neon Toast Overlay */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: "30px",
          right: "30px",
          zIndex: 9999,
          padding: "16px 24px",
          borderRadius: "14px",
          background: "rgba(15, 15, 21, 0.85)",
          backdropFilter: "blur(12px)",
          border: toast.type === "success" ? "1px solid #22c55e" : toast.type === "error" ? "1px solid #ff5b7f" : "1px solid var(--primary)",
          boxShadow: toast.type === "success" ? "0 0 20px rgba(34, 197, 94, 0.25)" : toast.type === "error" ? "0 0 20px rgba(255, 91, 127, 0.25)" : "0 0 20px var(--primary-glow)",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: "0.95rem",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          maxWidth: "380px",
          animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        }}>
          <span style={{ 
            width: "8px", 
            height: "8px", 
            borderRadius: "50%", 
            background: toast.type === "success" ? "#22c55e" : toast.type === "error" ? "#ff5b7f" : "var(--primary)",
            boxShadow: toast.type === "success" ? "0 0 8px #22c55e" : toast.type === "error" ? "0 0 8px #ff5b7f" : "0 0 8px var(--primary)"
          }} />
          <div>
            <div style={{ 
              fontWeight: 700, 
              fontSize: "0.8rem", 
              textTransform: "uppercase", 
              color: toast.type === "success" ? "#22c55e" : toast.type === "error" ? "#ff5b7f" : "var(--primary)", 
              letterSpacing: "0.06em", 
              marginBottom: "2px" 
            }}>
              {toast.type === "success" ? "Success" : toast.type === "error" ? "Transaction Failed" : "On-Chain Activity"}
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.4" }}>{toast.message}</div>
          </div>
        </div>
      )}

      {/* slideIn CSS Animation */}
      <style>{`
        @keyframes slideIn {
          0% {
            transform: translateY(20px) scale(0.95);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
