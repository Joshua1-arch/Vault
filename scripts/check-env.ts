import * as dotenv from "dotenv";
dotenv.config({ override: true });

console.log("==========================================");
console.log(`dotenv loaded TIMELOCK_ADDRESS: ${process.env.TIMELOCK_ADDRESS}`);
console.log(`dotenv loaded DEADMAN_ADDRESS: ${process.env.DEADMAN_ADDRESS}`);
console.log(`dotenv loaded MULTISIG_ADDRESS: ${process.env.MULTISIG_ADDRESS}`);
console.log("==========================================");
