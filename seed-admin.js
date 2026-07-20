const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const bcrypt = require('./backend/node_modules/bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: { role: 'ADMIN', password: hashedPassword },
    create: {
      email: 'admin@test.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN'
    }
  });
  console.log('Admin seeded');
}
main();
