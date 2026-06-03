# 📝 Story Protocol CDR Hackathon — Submission Answers

Here are the complete answers to the Google Form questions based on the VaultLetter project we have built. 

---

### 1. Your name *
> **Joshua Adekunle**

---

### 2. Title of your project *
> **VaultLetter**

---

### 3. Describe what your project is (important!) *
> **VaultLetter** is an ultra-premium, private, time-locked message vault. It enables secure compose-and-seal flows where highly sensitive or long-term private letters (like estate planning, future-dated journals, inheritance key handovers, and collaborative multi-sig secrets) are encrypted and can only be decrypted when on-chain read conditions are fully satisfied.
>
> The project features a stunning glassmorphism dashboard, second-by-second ticking countdown timers, a case-insensitive recipient verification system, and an absolute sender lockout security architecture (meaning once you seal a letter, even you cannot open it back up).

---

### 4. Describe how your project uses CDR *
> VaultLetter encrypts and seals private letter payloads directly using Story Protocol's Confidential Data Rails (CDR).
>
> **On-Chain Custom Conditions:** We wrote and deployed three Solidity condition contracts implementing the new 4-argument `IReadCondition` interface:
> *   `TimelockCondition`: Restricts decryption access until a specific future epoch timestamp (`block.timestamp >= unlockAt`).
> *   `DeadManSwitch`: A stateful centerpiece contract. The owner periodically broadcasts check-in transactions. If they miss their inactivity window, the designated recipient is authorized to decrypt the envelope.
> *   `MultiSigCondition`: An M-of-N signature condition where signers register approvals on-chain; threshold decryption becomes accessible once the approved threshold is met.
>
> **SDK Integration Breakthrough:** During development with `@piplabs/cdr-sdk` (v0.2.1), we identified that the SDK's validation helper (`validateConditionContract`) hardcodes/enforces the old 3-argument signature standard. However, the live Aeneid registry executes the newer 4-argument signature during decryption, causing EOA-reverts on contract-based vaults. To resolve this, we bypassed the SDK validation using `skipConditionValidation: true` and manually orchestrated the 3-step vault allocation, data-key encryption, and write pipeline.

---

### 5. Demo video/recording of you using your application *
> *[Note: Paste your recorded YouTube, Loom, or drive video link here. If you haven't uploaded it yet, you can record a quick screen walk-through of the frontend showing the compose, sealed count-down envelope, and reveal screens, then drop the link here.]*

---

### 6. Your email *
> **adekunlejoshua809@gmail.com**

---

### 7. Your Discord handle (optional)
> *[Note: Enter your Discord username here (e.g. `joshua_dev` or similar if applicable)]*

---

### 8. If you had any teammates, list them here (optional)
> *[Note: Leave blank or enter names if you had partners, otherwise write "Solo Developer" or leave blank.]*

---

### 9. Please upload your project code to GitHub. If you do not want to make your project public, that is okay, but you must add `jacob-tucker` to the repository. Then put the GitHub link below. *
> **https://github.com/Joshua1-arch/Vault.git**
> *(Please ensure you add `jacob-tucker` as a collaborator if the repository is private!)*

---

### 10. Which track do you think your project belongs to? Note that this does not affect your project. I will put your project in the best track to help it win. *
> Choose: **Technical Implementation** and **Best CDR Application**

---

### 11. Rate your experience building with CDR. 1 is very difficult, 5 is very easy. *
> **4 / 5** (or **3 / 5** if you want to emphasize the SDK debug overhead)

---

### 12. Was anything about CDR confusing, or was it easy to understand? *
> The architectural concepts of read conditions, vault allocation, threshold decryption, and keyshares were elegant and easy to understand.
> 
> However, debugging custom condition contracts on testnet was challenging because the CDR registry contract reverts with empty data (`0x`) for failures rather than standard string errors. Furthermore, the mismatch between the SDK helper validation checks and the actual Aeneid registry signature validation (3-arg vs 4-arg) caused initial confusion and required diving into the SDK internals to bypass.

---

### 13. Any feedback about building with CDR? Anything we can improve? *
> 1. **Align SDK and Contract Interface**: Update `@piplabs/cdr-sdk`'s `validateConditionContract` method to support the active 4-argument on-chain condition check.
> 2. **Better Revert Trace Info**: Return descriptive custom errors or error messages from the CDR registry contract rather than returning empty `0x` revert data, which makes debugging EVM reverts extremely difficult.
> 3. **Custom Condition Templates**: Provide developer documentation or examples showcasing stateful read conditions (like Dead-Man switches or on-chain multi-sig thresholds) rather than just stateless timelocks.
