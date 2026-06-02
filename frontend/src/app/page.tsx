"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWalletClient, usePublicClient, useAccount } from "wagmi";
import { ethers } from "ethers";
import { toHex } from "viem";

export default function WritePage() {
  const router = useRouter();

  // Core Account & Client States from Wagmi
  const { address: walletAddress, isConnected: walletConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // Form States
  const [letter, setLetter] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [conditionType, setConditionType] = useState<"timelock" | "deadman" | "multisig">("timelock");

  // Condition Parameters
  const [unlockAt, setUnlockAt] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState("300"); // 5 minutes default
  const [signers, setSigners] = useState("");
  const [threshold, setThreshold] = useState("2");

  // Processing UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  function toggleDemoMode() {
    const newDemo = !demoMode;
    setDemoMode(newDemo);
    if (newDemo) {
      setRecipientAddress("0x897cCcE794dF3B2f523F40C5bE9FB07e9bB48041");
      setLetter("This is a sample time-locked secret message created in Demo Mode on Story CDR.");
      setConditionType("timelock");
      
      const defaultDate = new Date();
      defaultDate.setMinutes(defaultDate.getMinutes() + 2);
      const tzOffset = defaultDate.getTimezoneOffset() * 60000;
      const localISOTime = new Date(defaultDate.getTime() - tzOffset).toISOString().slice(0, 16);
      setUnlockAt(localISOTime);
    } else {
      setLetter("");
      setRecipientAddress("");
    }
  }

  // Pre-fill default timelock to +1 hour on mount
  useEffect(() => {
    const defaultDate = new Date();
    defaultDate.setHours(defaultDate.getHours() + 1);
    const tzOffset = defaultDate.getTimezoneOffset() * 60000;
    const localISOTime = new Date(defaultDate.getTime() - tzOffset).toISOString().slice(0, 16);
    setUnlockAt(localISOTime);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!letter || !recipientAddress) {
      alert("Please fill out the letter content and recipient address.");
      return;
    }

    if (!walletConnected || !walletAddress || !walletClient || !publicClient) {
      alert("Please connect your wallet first to authorize on-chain transactions.");
      return;
    }

    setIsSubmitting(true);
    setSubmitStep("Loading secure CDR SDK engine...");

    try {
      // 1. Dynamic import and WebAssembly initialization to bypass Next.js SSR build conflicts
      const sdk = await import("@piplabs/cdr-sdk");
      await sdk.initWasm();

      const cdrClient = new sdk.CDRClient({
        network: "testnet",
        publicClient,
        walletClient,
        apiUrl: "http://172.192.41.96:1317"
      });

      setSubmitStep("Encoding cryptographic read and write conditions...");

      // Encode read condition data based on selection
      let readConditionAddr = "";
      let readConditionData = "";

      if (conditionType === "timelock") {
        readConditionAddr = "0x166083e33fd2cb924d5b188f80b856a99bfc7d2c";
        const unlockAtUnix = Math.floor(new Date(unlockAt).getTime() / 1000);
        readConditionData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [BigInt(unlockAtUnix)]);
      } else if (conditionType === "deadman") {
        readConditionAddr = "0x9a736dd318d09ccc87cb4ed5f6528a13ed5ba692";
        const interval = parseInt(intervalSeconds, 10);
        readConditionData = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "address", "uint256"],
          [walletAddress as `0x${string}`, recipientAddress as `0x${string}`, BigInt(interval)]
        );
      } else if (conditionType === "multisig") {
        readConditionAddr = "0xbaa6a2d58487a4363b01ff65f3d09a521147f0f7";
        const signerList = signers.split(",").map(s => s.trim() as `0x${string}`);
        const th = parseInt(threshold, 10);
        readConditionData = ethers.AbiCoder.defaultAbiCoder().encode(
          ["address[]", "uint256"],
          [signerList, BigInt(th)]
        );
      }

      // OwnerWriteCondition restricting edits to the original sender
      const writeConditionAddr = "0x4C9bFC96d7092b590D497A191826C3dA2277c34B";
      const writeConditionData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [walletAddress as `0x${string}`]
      );

      const messageBytes = new TextEncoder().encode(letter);

      // STEP 1 Browser Transaction: Allocate Secure Metadata Slot
      setSubmitStep("Popping Wallet: Approve metadata slot allocation (1/2)...");
      const { uuid, txHash: allocateTx } = await cdrClient.uploader.allocate({
        updatable: false,
        writeConditionAddr: writeConditionAddr as `0x${string}`,
        writeConditionData: writeConditionData as `0x${string}`,
        readConditionAddr: readConditionAddr as `0x${string}`,
        readConditionData: readConditionData as `0x${string}`,
        skipConditionValidation: true,
      });

      console.log(`CDR Vault allocated. UUID: ${uuid}, Allocate Tx: ${allocateTx}`);
      setSubmitStep("Encrypting payload locally in your browser...");

      // Encrypt locally using UUID-derived label (never touches server)
      const label = sdk.uuidToLabel(uuid);
      const globalPubKey = await cdrClient.observer.getGlobalPubKey();
      const ciphertext = await cdrClient.uploader.encryptDataKey({
        dataKey: messageBytes,
        globalPubKey,
        label,
      });

      // STEP 2 Browser Transaction: Write Ciphertext to Registry
      setSubmitStep("Popping Wallet: Approve writing encrypted payload to Story (2/2)...");
      const { txHash: writeTx } = await cdrClient.uploader.write({
        uuid,
        accessAuxData: "0x",
        encryptedData: toHex(ciphertext.raw),
      });

      console.log(`CDR Vault secured on-chain. Write Tx: ${writeTx}`);
      setSubmitStep("Secured! Registering registry metadata with server...");

      // Register metadata on the local db.json server
      const response = await fetch("http://localhost:3001/api/create-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid,
          conditionType,
          conditionParams: {
            unlockAt,
            intervalSeconds,
            signers: signers.split(",").map(s => s.trim()),
            threshold: parseInt(threshold, 10)
          },
          recipientAddress,
          senderAddress: walletAddress
        })
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to register envelope with custodian server.");
      }

      setSubmitStep("Redirecting to countdown...");
      await new Promise(r => setTimeout(r, 1000));
      router.push(`/vault/${uuid}`);
    } catch (err: any) {
      console.error(err);
      alert(`Sealing failed: ${err.message || err}`);
      setIsSubmitting(false);
      setSubmitStep("");
    }
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "2.8rem", marginBottom: "10px" }}>Write Future Vault</h1>
        <p className="subtitle">
          Compose private letters that remain encrypted until on-chain conditions are met.
        </p>
      </div>

      {/* Connection Indicator Alert */}
      <div className="glass-card flex-center" style={{ gap: "20px", marginBottom: "30px", padding: "16px 24px", justifyContent: "space-between", borderRadius: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.2rem" }}>{walletConnected ? "🟢" : "🔴"}</span>
          <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 500 }}>
            {walletConnected ? "Authorized Session Active" : "No Wallet Connected in Header"}
          </span>
        </div>
        {!walletConnected && (
          <span style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 600 }}>
            * Connect Wallet at the Top Right
          </span>
        )}
      </div>

      {/* Demo Mode Toggle */}
      <div className="glass-card flex-center" style={{ padding: "12px 20px", marginBottom: "30px", justifyContent: "space-between", borderRadius: "14px", border: "1px dashed var(--primary)" }}>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--primary)" }}>⚡ Sandbox Demo Mode</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Auto-prefills a 2-minute timelocked demo vault</div>
        </div>
        <label className="switch" style={{ position: "relative", display: "inline-block", width: "50px", height: "26px" }}>
          <input type="checkbox" checked={demoMode} onChange={toggleDemoMode} style={{ opacity: 0, width: 0, height: 0 }} />
          <span style={{
            position: "absolute",
            cursor: "pointer",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: demoMode ? "var(--primary)" : "#3a3a4c",
            transition: "0.3s",
            borderRadius: "34px",
            boxShadow: demoMode ? "0 0 10px var(--primary-glow)" : "none"
          }}>
            <span style={{
              position: "absolute",
              content: '""',
              height: "18px", width: "18px",
              left: demoMode ? "28px" : "4px",
              bottom: "4px",
              backgroundColor: "white",
              transition: "0.3s",
              borderRadius: "50%"
            }} />
          </span>
        </label>
      </div>

      {isSubmitting ? (
        <div className="glass-card flex-center" style={{ flexDirection: "column", gap: "20px", padding: "60px 40px", textAlign: "center" }}>
          <div className="wax-seal pulsing">
            <span style={{ fontSize: "2.2rem" }}>🔒</span>
          </div>
          <h2 style={{ fontSize: "1.6rem" }}>Sealing Your Message</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "400px", minHeight: "60px" }}>{submitStep}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="form-group">
            <label>Recipient Address</label>
            <input
              type="text"
              placeholder="0xrecipient..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Letter Content</label>
            <textarea
              placeholder="Write your secret letter here..."
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              required
            />
          </div>

          {/* Condition Type Picker */}
          <div className="form-group">
            <label>Cryptographic Unlock Condition</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "5px" }}>
              <div
                className="glass-card flex-center"
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  flexDirection: "column",
                  gap: "8px",
                  borderColor: conditionType === "timelock" ? "var(--primary)" : "var(--card-border)",
                  boxShadow: conditionType === "timelock" ? "0 0 15px var(--primary-glow)" : "none",
                  textAlign: "center"
                }}
                onClick={() => setConditionType("timelock")}
              >
                <span style={{ fontSize: "1.8rem" }}>⏳</span>
                <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Timelock</span>
              </div>

              <div
                className="glass-card flex-center"
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  flexDirection: "column",
                  gap: "8px",
                  borderColor: conditionType === "deadman" ? "var(--primary)" : "var(--card-border)",
                  boxShadow: conditionType === "deadman" ? "0 0 15px var(--primary-glow)" : "none",
                  textAlign: "center"
                }}
                onClick={() => setConditionType("deadman")}
              >
                <span style={{ fontSize: "1.8rem" }}>💀</span>
                <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Dead-Man</span>
              </div>

              <div
                className="glass-card flex-center"
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  flexDirection: "column",
                  gap: "8px",
                  borderColor: conditionType === "multisig" ? "var(--primary)" : "var(--card-border)",
                  boxShadow: conditionType === "multisig" ? "0 0 15px var(--primary-glow)" : "none",
                  textAlign: "center"
                }}
                onClick={() => setConditionType("multisig")}
              >
                <span style={{ fontSize: "1.8rem" }}>👥</span>
                <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Multi-Sig</span>
              </div>
            </div>
          </div>

          {/* Condition Param Details */}
          {conditionType === "timelock" && (
            <div className="form-group" style={{ background: "rgba(255,255,255,0.02)", padding: "20px", borderRadius: "12px" }}>
              <label>Unlock At Date & Time</label>
              <input
                type="datetime-local"
                value={unlockAt}
                onChange={(e) => setUnlockAt(e.target.value)}
                required
              />
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "5px" }}>
                The letter will remain completely unreadable until this timestamp.
              </p>
            </div>
          )}

          {conditionType === "deadman" && (
            <div className="form-group" style={{ background: "rgba(255,255,255,0.02)", padding: "20px", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label>Inactivity Interval</label>
                <select value={intervalSeconds} onChange={(e) => setIntervalSeconds(e.target.value)}>
                  <option value="60">1 Minute (For testing)</option>
                  <option value="300">5 Minutes</option>
                  <option value="3600">1 Hour</option>
                  <option value="86400">1 Day</option>
                  <option value="2592000">30 Days</option>
                </select>
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                You must periodically call the dead-man switch `checkIn()` function. If you are inactive for this interval, the recipient can reveal the letter.
              </p>
            </div>
          )}

          {conditionType === "multisig" && (
            <div className="form-group" style={{ background: "rgba(255,255,255,0.02)", padding: "20px", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label>Signer Addresses (comma-separated)</label>
                <input
                  type="text"
                  placeholder="0xsigner1, 0xsigner2, 0xsigner3"
                  value={signers}
                  onChange={(e) => setSigners(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Threshold Approvals Required</label>
                <input
                  type="number"
                  min="1"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  required
                />
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Unlocks only when {threshold} out of the specified signers register their approvals on-chain.
              </p>
            </div>
          )}

          <button className="btn" type="submit" disabled={!walletConnected} style={{ marginTop: "10px" }}>
            🔒 Seal Envelope on Story CDR
          </button>
          {!walletConnected && (
            <p style={{ color: "var(--accent)", fontSize: "0.85rem", textAlign: "center", fontWeight: 500 }}>
              * Please connect your wallet in the header to authorize secure envelope allocation.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
