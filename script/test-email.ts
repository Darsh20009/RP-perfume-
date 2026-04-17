import { sendWelcomeEmail } from "../server/email";

async function main() {
  console.log("[TEST] Sending welcome email to youssefd.business@gmail.com...");
  const result = await sendWelcomeEmail({
    to: "youssefd.business@gmail.com",
    customerName: "يوسف",
  });
  console.log("[TEST] Result:", JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("[TEST] Error:", err);
  process.exit(1);
});
