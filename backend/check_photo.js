const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.memberProfile.findMany({
    select: { userId: true, photoUrl: true }
  });
  console.log(profiles);
}
main().catch(console.error).finally(() => prisma.$disconnect());
