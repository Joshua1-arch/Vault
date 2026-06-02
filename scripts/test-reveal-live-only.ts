import * as dotenv from "dotenv";

dotenv.config({ override: true });

async function main() {
  const recipientAddress = "0xec5D096738641dBF3099Ad630D91e922425c48D8";

  console.log("\n1. Requesting POST /api/create-vault...");
  const createRes = await fetch("http://localhost:3001/api/create-vault", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      letter: "This is a super secret letter encrypted end-to-end with Story CDR!",
      conditionType: "timelock",
      conditionParams: {
        unlockAt: new Date(Date.now() - 3600 * 1000).toISOString() // 1 hour ago (unlocked)
      },
      recipientAddress
    })
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("Create Vault Failed:", err);
    return;
  }

  const createData: any = await createRes.json();
  console.log("Create Vault Response:", createData);
  const uuid = createData.uuid;

  console.log(`\n2. Requesting POST /api/reveal/${uuid}...`);
  const revealRes = await fetch(`http://localhost:3001/api/reveal/${uuid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });

  if (!revealRes.ok) {
    const err = await revealRes.text();
    console.error("Reveal Vault Failed:", err);
    return;
  }

  const revealData: any = await revealRes.json();
  console.log("\n=======================================================");
  console.log("SUCCESS!!! VAULTLETTER END-TO-END DECRYPTION WORKS!");
  console.log("Response:", revealData);
  console.log("=======================================================");
}

main().catch(console.error);
