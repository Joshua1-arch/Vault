import * as dotenv from "dotenv";

dotenv.config({ override: true });

async function main() {
  const senderAddress = "0xec5D096738641dBF3099Ad630D91e922425c48D8"; // Server's wallet as sender
  const recipientAddress = "0x897cCcE794dF3B2f523F40C5bE9FB07e9bB48041"; // Simulated recipient address
  const strangerAddress = "0x999d9b41a824b26e3bb94452c4c9735fda46ca45"; // Random stranger

  console.log("\n=== 1. Creating Vault with Sender & Recipient Address ===");
  const createRes = await fetch("http://localhost:3001/api/create-vault", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      letter: "Highly sensitive locked envelope contents designed for recipient eyes only.",
      conditionType: "timelock",
      conditionParams: {
        unlockAt: new Date(Date.now() - 3600 * 1000).toISOString() // 1 hour ago (unlocked)
      },
      recipientAddress,
      senderAddress
    })
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("Create Vault Failed:", err);
    return;
  }

  const createData: any = await createRes.json();
  const uuid = createData.uuid;
  console.log(`Vault successfully allocated on Story CDR! UUID: ${uuid}`);

  console.log("\n=== 2. Attempt 1: Reveal requested by the SENDER (Lockout Check) ===");
  const senderRes = await fetch(`http://localhost:3001/api/reveal/${uuid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callerAddress: senderAddress })
  });
  console.log(`Status returned: ${senderRes.status}`);
  const senderData = await senderRes.json();
  console.log(`Response Payload:`, senderData);
  if (senderRes.status === 403 && senderData.error.includes("You sealed this letter")) {
    console.log("🟢 SUCCESS: Sender is locked out completely!");
  } else {
    console.log("🔴 FAILURE: Sender was not locked out!");
  }

  console.log("\n=== 3. Attempt 2: Reveal requested by a STRANGER (Recipient Check) ===");
  const strangerRes = await fetch(`http://localhost:3001/api/reveal/${uuid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callerAddress: strangerAddress })
  });
  console.log(`Status returned: ${strangerRes.status}`);
  const strangerData = await strangerRes.json();
  console.log(`Response Payload:`, strangerData);
  if (strangerRes.status === 403 && strangerData.error.includes("This letter was not addressed to you")) {
    console.log("🟢 SUCCESS: Non-recipient was successfully denied access!");
  } else {
    console.log("🔴 FAILURE: Stranger was not blocked!");
  }

  console.log("\n=== 4. Attempt 3: Reveal requested with missing callerAddress ===");
  const missingRes = await fetch(`http://localhost:3001/api/reveal/${uuid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  console.log(`Status returned: ${missingRes.status}`);
  const missingData = await missingRes.json();
  console.log(`Response Payload:`, missingData);
  if (missingRes.status === 400) {
    console.log("🟢 SUCCESS: Missing parameter check validated!");
  } else {
    console.log("🔴 FAILURE: Empty parameter allowed!");
  }

  console.log("\nDone!");
}

main().catch(console.error);
