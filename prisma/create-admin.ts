/**
 * Create the first administrator on a fresh (empty) database — no demo data.
 *
 *   npm run db:create-admin -- --login admin --email you@company.com --name "Your Name" \
 *     --password "a-long-password" [--site WH-MAIN --site-name "Main DC" --city "Milan" --timezone Europe/Rome]
 *
 * Safe to re-run: an existing login is updated (password reset, role set to admin).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined && fallback === undefined) {
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  return (v ?? fallback) as string;
}

async function main() {
  const login = arg("login");
  const email = arg("email");
  const name = arg("name");
  const password = arg("password");
  if (password.length < 10) throw new Error("Password must be at least 10 characters.");

  let site = await prisma.warehouse.findFirst({ orderBy: { createdAt: "asc" } });
  if (!site) {
    const id = arg("site", "WH-MAIN").toUpperCase();
    if (!/^WH-[A-Z0-9]{2,8}$/.test(id)) throw new Error("--site must look like WH-XXX");
    site = await prisma.warehouse.create({
      data: { id, name: arg("site-name", "Main Distribution Center"), city: arg("city", "—"), timezone: arg("timezone", "UTC") },
    });
    console.log(`Created site ${site.id} (${site.name}). Add zones and locations in the app: Locations → Add locations.`);
  }
  await prisma.sequence.createMany({
    data: ["SO", "ASN", "PK", "TR", "ADJ", "SUP", "CUS", "BADGE"].map((n) => ({ name: n, value: n === "SO" ? 100000 : n === "ASN" ? 50000 : n === "BADGE" ? 1000 : 1000 })),
    skipDuplicates: true,
  });
  const exists = await prisma.setting.findUnique({ where: { key: "organization" } });
  if (!exists) {
    await prisma.setting.createMany({
      data: [
        { key: "organization", value: { company: "", timezone: site.timezone, units: "metric", dateFormat: "dd MMM yyyy", currency: "EUR", allocation: "FEFO", putaway: "Closest empty", autoApproveLimit: "250", cycleCountDays: "90" } },
        { key: "integrations", value: {} },
        { key: "notificationPrefs", value: {} },
      ],
      skipDuplicates: true,
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { login },
    create: { login, email, name, passwordHash, role: "admin", warehouseId: null },
    update: { email, name, passwordHash, role: "admin", active: true },
  });
  console.log(`Administrator "${user.login}" is ready. Sign in at /login.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
