import mongoose from "mongoose";
import { MailAccountModel } from "../server/models";
import { syncAccount } from "../server/inbox";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const accounts = await MailAccountModel.find({ isActive: true });
  for (const a of accounts) {
    try {
      console.log(`→ Syncing ${a.email}...`);
      const r = await syncAccount(a._id.toString(), { limit: 10 });
      console.log(`  ✓ fetched=${r.fetched} stored=${r.stored}`);
    } catch (e: any) {
      console.log(`  ✗ FAILED: ${e?.message}`);
    }
  }
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
