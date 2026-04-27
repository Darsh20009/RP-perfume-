import mongoose from "mongoose";
import { MailAccountModel, UserModel } from "../server/models";
import { encryptSecret } from "../server/inbox";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const admin = await UserModel.findOne({ role: "admin" }).lean();
  const adminId = admin ? String((admin as any)._id) : "";
  console.log("Admin id:", adminId, "phone:", (admin as any)?.phone);

  const HOST = "server222.web-hosting.com";
  const PASS = "ASDqwe@12345678";

  const accounts = [
    { email: "m.alzaeaqi@rfperfume.sa", displayName: "المدير - م. الزعاقي", color: "#1a2744", userId: adminId },
    { email: "e-mgr@rfperfume.sa",      displayName: "مدير التشغيل",        color: "#c9a96e", userId: "" },
    { email: "fin-de@rfperfume.sa",     displayName: "القسم المالي",         color: "#10b981", userId: "" },
    { email: "hr@rfperfume.sa",         displayName: "الموارد البشرية",       color: "#8b5cf6", userId: "" },
    { email: "info@rfperfume.sa",       displayName: "الاستفسارات العامة",    color: "#3b82f6", userId: "" },
  ];

  for (const a of accounts) {
    const existing = await MailAccountModel.findOne({ email: a.email });
    if (existing) {
      existing.password = encryptSecret(PASS);
      existing.imapHost = HOST; existing.imapPort = 993;
      existing.smtpHost = HOST; existing.smtpPort = 465;
      existing.provider = "custom";
      existing.displayName = a.displayName;
      existing.color = a.color;
      existing.userId = a.userId;
      existing.isActive = true;
      await existing.save();
      console.log("UPDATED:", a.email);
    } else {
      await MailAccountModel.create({
        email: a.email, displayName: a.displayName, provider: "custom", userId: a.userId,
        imapHost: HOST, imapPort: 993, smtpHost: HOST, smtpPort: 465,
        password: encryptSecret(PASS), color: a.color, isActive: true,
      });
      console.log("CREATED:", a.email);
    }
  }

  const all = await MailAccountModel.find({}).select("email displayName userId").lean();
  console.log("\nAll mailboxes:");
  for (const m of all) console.log(" -", (m as any).email, "→", (m as any).userId || "(مشترك)", "|", (m as any).displayName);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
