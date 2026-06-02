# ✉️ VaultLetter — CDR Hackathon Final Sprint Record
VaultLetter is an ultra-premium, private, time-locked message vault built for the **Story Protocol CDR Hackathon** (build.usecdr.dev), competing in the Technical Implementation and Best CDR Application prize tracks. 

The application enables secure compose-and-seal flows where highly sensitive or long-term private letters are encrypted using Story Protocol's **Confidential Data Rails (CDR)** and can only be decrypted when on-chain read conditions are fully satisfied.

---

## 🏗️ Premium Multi-Layer Architecture

### 1. Layer 1 — Smart Contracts (`contracts/`)
We developed, compiled, and deployed three advanced Solidity condition contracts that implement Story Protocol's `IReadCondition` interface with the correct, active 4-argument on-chain signature standard:
`function checkReadCondition(uint32 uuid, bytes calldata accessAuxData, bytes calldata conditionData, address caller) external view returns (bool)`

*   **`TimelockCondition.sol`**: RESTRICTS access until a specific future epoch time via `block.timestamp >= unlockAt`.
*   **`DeadManSwitch.sol`**: STATEFUL centerpiece. The owner periodically broadcasts a `checkIn()` transaction. If they miss their inactivity window, the designated recipient is authorized to decrypt the envelope.
*   **`MultiSigCondition.sol`**: COLLABORATIVE M-of-N signature condition. Signers submit approvals for a vault UUID on-chain; the condition unlocks once the threshold of registered approvals is met.

#### 🚀 Deployed addresses (Story Aeneid Testnet)
*   **`TIMELOCK_ADDRESS`**: `0x166083e33fd2cb924d5b188f80b856a99bfc7d2c`
*   **`DEADMAN_ADDRESS`**: `0x9a736dd318d09ccc87cb4ed5f6528a13ed5ba692`
*   **`MULTISIG_ADDRESS`**: `0xbaa6a2d58487a4363b01ff65f3d09a521147f0f7`

---

### 2. Layer 2 — Express CDR SDK Backend (`backend/`)
We constructed a robust, state-of-the-art Node.js Express server using TypeScript, fully integrating the `@piplabs/cdr-sdk` (v0.2.1) and Viem to manage threshold decryption and vault registry queries:

*   **File Location**: [backend/server.ts](file:///c:/Users/Joshua/Desktop/Vault/backend/server.ts)
*   **WASM & SDK Verification Breakthrough**: 
    *   **The Bug**: Identified that the `@piplabs/cdr-sdk` has an outdated validation helper (`validateConditionContract`) that enforces the old 3-argument signature. However, the live Aeneid registry actually executes the new 4-argument signature during decryption, causing EOA-reverts on active contract-based vaults.
    *   **The Fix**: Rewrote the upload pipeline to execute a manual 3-step vault allocation and write (`allocate` -> `encryptDataKey` -> `write`) using `skipConditionValidation: true` to bypass the outdated validation helper, allowing custom condition contracts to execute natively on the Aeneid network.
*   **API Endpoints**:
    *   `POST /api/create-vault`: Receives composition inputs, encodes parameters for each condition type, allocates a vault UUID on the CDR registry, writes the encrypted payload, and persists vault records in `backend/db.json`.
    *   `GET /api/check-condition/:uuid`: Queries the on-chain registry state, triggers contract calls to evaluate conditional unlock states, and calculates countdowns or signer approval states.
    *   `POST /api/reveal/:uuid`: Verifies block status and, if satisfied, calls the SDK's `consumer.accessCDR` to perform threshold decryption, returning the decrypted letter.
*   **Start Command**: `npm run start:backend` (configured in `package.json`).

---

### 3. Layer 3 — Next.js Web3 Frontend (`frontend/`)
We bootstrapped a dynamic Next.js App Router project styled with a sleek dark glassmorphism system:

*   **Write Page ([frontend/src/app/page.tsx](file:///c:/Users/Joshua/Desktop/Vault/frontend/src/app/page.tsx))**: Composes letters, connects Web3 wallets, and contains card-based selectors for Timelock, Dead-Man, and Multi-Sig options.
*   **Vault Page ([frontend/src/app/vault/[uuid]/page.tsx](file:///c:/Users/Joshua/Desktop/Vault/frontend/src/app/vault/[uuid]/page.tsx))**: An interactive sealed envelope UI displaying a pulsing wax seal, ticking countdowns, and signers checklist, polling the blockchain every 3 seconds.
*   **Reveal Page ([frontend/src/app/reveal/[uuid]/page.tsx](file:///c:/Users/Joshua/Desktop/Vault/frontend/src/app/reveal/[uuid]/page.tsx))**: Triggers the validator decryption phase and reveals the decrypted letter inside an elegant typographical frame.
*   **Global Design ([frontend/src/app/globals.css](file:///c:/Users/Joshua/Desktop/Vault/frontend/src/app/globals.css))**: Ultra-premium dark theme styling using Outfit (UI) and Playfair Display (Serif typography), custom glassmorphism, and animated seals.

---

## ⚡ Final Sprint Sandbox & UI Polish Upgrades

### 🩹 E2E Sandbox Validation Scripts (`scripts/`)
We wrote and executed complete E2E sandbox integration scripts to verify conditional unlocks against the live Story Aeneid network:

1.  **Dead-Man Switch Script ([scripts/test-deadman-e2e.ts](file:///c:/Users/Joshua/Desktop/Vault/scripts/test-deadman-e2e.ts))**:
    *   Deploys a new 60s CDR vault, broadcasts a check-in transaction, and waits block-by-block.
    *   Confirms read condition starts `false` (locked) and automatically evaluates to `true` (unlocked) post-expiration.
    *   Logs validator retry traces with exponential backoff.
2.  **Timelock Reveal Script ([scripts/test-reveal-e2e.ts](file:///c:/Users/Joshua/Desktop/Vault/scripts/test-reveal-e2e.ts))**:
    *   Deploys a 2-minute dynamic Timelock vault, validates immediate lock status, waits 125 seconds, and evaluates post-expiration unlock status.
    *   Logs complete round-trip timing details (233 seconds total) and registers a successful run exit code `0`.
3.  **Live E2E Reveal Verification ([scripts/test-reveal-live-only.ts](file:///c:/Users/Joshua/Desktop/Vault/scripts/test-reveal-live-only.ts))**:
    *   Executes full backend integration testing on the live network, creating a timelock vault and executing threshold decryption successfully to recover the envelope payload.
4.  **Live Recipient Enforcement & Sender Lockout Verification ([scripts/test-lockout-e2e.ts](file:///c:/Users/Joshua/Desktop/Vault/scripts/test-lockout-e2e.ts))**:
    *   Verifies case-insensitive sender lockout and recipient checking against the backend Express server.
    *   Asserts proper lockout `403` response for the sender ("You sealed this letter...") and authorized recipient resolution.

---

### 🛡️ Recipient Verification & Sender Lockout Security Architecture

To ensure high cryptographic security and enforce VaultLetter's core principle—**that the act of sealing is permanent, absolute, and irreversible even for the sender**—we implemented multi-layer wallet validation checks:

1.  **Backend Custodian Gateway (`backend/server.ts`)**:
    *   **Create Route**: Receives and stores both `recipientAddress` and `senderAddress` (the connected wallet of the composer) in `db.json`.
    *   **Reveal Route**: Extracts the frontend's connected wallet address (`callerAddress`). It runs a case-insensitive check.
    *   **Rule 1 (Sender Lockout - MUST run first)**: If `callerAddress === senderAddress`, returns `403` with a custom error: `You sealed this letter. Once sent, even you cannot read it.`
    *   **Rule 2 (Recipient Only)**: If `callerAddress !== recipientAddress`, returns `403` with: `This letter was not addressed to you.`
2.  **Frontend Wallet Integration (`frontend/`)**:
    *   **Write Page ([page.tsx](file:///c:/Users/Joshua/Desktop/Vault/frontend/src/app/page.tsx))**: Enforces that the composer connects their wallet using RainbowKit/Wagmi, automatically tracking their address as `senderAddress`.
    *   **Reveal Page ([reveal/[uuid]/page.tsx](file:///c:/Users/Joshua/Desktop/Vault/frontend/src/app/reveal/[uuid]/page.tsx))**: Checks if a wallet is connected. If disconnected, shows a premium Connect Wallet banner using RainbowKit's `<ConnectButton>`. Once connected, passes the address as `callerAddress` to the reveal endpoint.
    *   **Sealed Beyond Reach Screen**: If the backend returns the `403` sender lockout error, renders an intentional, gorgeous custom display featuring a crimson wax seal graphic (`📜`) explaining that their sealed envelope is irreversibly out of reach.

### 🎨 Premium UI Polish for Demo Video & Judges

1.  **⚡ Sandbox Demo Mode (Write Page)**:
    *   Added a dashed-purple border toggle switch at the top of the envelope composition form.
    *   Activating it connects the sandbox wallet, pre-fills the secret content, and calculates a 2-minute dynamic timelock.
2.  **⏱️ Live Countdown Timer & Share on X (Vault Page)**:
    *   Replaced database polling delays with a **second-by-second ticking digital countdown** local state for ultra-smooth UI changes.
    *   Implemented a **"Share on X" button** that dynamically computes the remaining minutes and opens a custom tweet draft pre-filled with the exact URL.
3.  **🏷️ Nested Server-Side OpenGraph Metadata ([vault/[uuid]/layout.tsx](file:///c:/Users/Joshua/Desktop/Vault/frontend/src/app/vault/[uuid]/layout.tsx))**:
    *   Designed a nested metadata file to inject dynamic OpenGraph tags, ensuring social shares display a stunning preview card.
4.  **✨ Materialize Entrance Transition (Reveal Page)**:
    *   Injected a self-contained CSS `@keyframes` materialization transition. Upon threshold decryption, the letter de-blurs, slides up, and transitions opacity, adding premium polish.

---

## 📸 Verified Sandbox & Web3 UI Interfaces

### ⚡ Sandbox Demo Mode
Our browser validation confirmed that Turbopack hot-compiles the new visual additions flawlessly. Here is the verified Sandbox Demo layout:

![VaultLetter Sandbox Demo Mode](file:///C:/Users/Joshua/.gemini/antigravity/brain/5c07c994-9b31-4083-a3b2-d6f294f97e5f/vaultletter_demo_mode_1780351697485.png)
*(Screenshot of the verified Write page featuring the new dashed primary Sandbox Demo Mode toggle)*

### 🔌 Web3 & RainbowKit Integration
A clean, minimal `<ConnectButton>` (displaying only the Aeneid chain badge for privacy) is mounted directly inside the top-right header:

![VaultLetter Web3 Connect Button](file:///C:/Users/Joshua/.gemini/antigravity/brain/5c07c994-9b31-4083-a3b2-d6f294f97e5f/vaultletter_web3_success_1780348512516.png)
*(Screenshot showing the header ConnectButton successfully rendered on the dynamic dark glassmorphism layout)*

---

## 🛠️ Sandbox Execution Commands

1.  Start the Express CDR backend:
    ```bash
    npm run start:backend
    ```
2.  Start the Next.js development server:
    ```bash
    cd frontend
    npm run dev
    ```
3.  Open `http://localhost:3000` to interact with VaultLetter!
