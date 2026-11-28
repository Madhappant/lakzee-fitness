import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { migrateSingleBranchToPrimary } from '../scripts/migrate-multi-branch';
import { PRIMARY_BRANCH_ID } from '../src/utils/tenant';

const prisma = new PrismaClient();

async function main() {
  // Ensure Branch #1 exists and any legacy single-branch rows are linked before seeding
  const migration = await migrateSingleBranchToPrimary(prisma);
  console.log(`✅ Multi-branch primary sync complete (${migration.branchId})`);

  const adminEmail = 'madhappandharman@gmail';
  const emailToUse = adminEmail.includes('.com') ? adminEmail : `${adminEmail}.com`;

  const existingAdmin = await prisma.user.findUnique({
    where: { email: emailToUse },
  });

  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('M@dhappan2003', salt);

    await prisma.user.create({
      data: {
        email: emailToUse,
        password: hashedPassword,
        role: 'ADMIN',
        branchId: PRIMARY_BRANCH_ID,
        firstName: 'Madhappan',
        lastName: 'Admin',
      },
    });
    console.log(`✅ Admin user seeded successfully! Email: ${emailToUse}`);
  } else if (!existingAdmin.branchId) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { branchId: PRIMARY_BRANCH_ID },
    });
    console.log(`ℹ️ Linked existing Admin user to primary branch. Email: ${emailToUse}`);
  } else {
    console.log(`ℹ️ Admin user already exists. Email: ${emailToUse}`);
  }

  // Seed Receptionist
  const receptionistEmail = 'sakthihari777@gmail.com';
  const existingReceptionist = await prisma.user.findUnique({
    where: { email: receptionistEmail },
  });

  const salt = await bcrypt.genSalt(10);
  const receptionistPassword = await bcrypt.hash('Sakthibhuvana', salt);

  if (!existingReceptionist) {
    await prisma.user.create({
      data: {
        email: receptionistEmail,
        password: receptionistPassword,
        role: 'RECEPTIONIST',
        branchId: PRIMARY_BRANCH_ID,
        firstName: 'Sakthi',
        lastName: 'Hari',
        roleAssignedAt: new Date(),
        staffProfile: {
          create: {
            designation: 'Receptionist',
          },
        },
      },
    });
    console.log(`✅ Receptionist user seeded successfully! Email: ${receptionistEmail}`);
  } else {
    await prisma.user.update({
      where: { email: receptionistEmail },
      data: {
        password: receptionistPassword,
        role: 'RECEPTIONIST',
        branchId: existingReceptionist.branchId ?? PRIMARY_BRANCH_ID,
        roleAssignedAt: new Date(),
      },
    });
    console.log(`✅ Receptionist user updated successfully! Email: ${receptionistEmail}`);
  }

  // Seed Default Plans under Primary Branch if absent
  const plansToSeed = [
    { name: 'Student', durationDays: 30, price: 999, description: 'Gym Access, Cardio, Locker' },
    { name: 'Monthly', durationDays: 30, price: 1499, description: 'Full Gym Access, Free Weights' },
    { name: 'Quarterly', durationDays: 90, price: 3999, description: 'All Monthly Features, Diet Plan' },
    { name: 'Half Year', durationDays: 180, price: 7499, description: 'All Quarterly Features, 2 PT Sessions' },
    { name: 'Yearly', durationDays: 365, price: 12999, description: 'All Features, Unlimited PT Consultations' },
    { name: 'Couple', durationDays: 30, price: 2499, description: 'Access for 2, Group Classes' },
  ];

  for (const p of plansToSeed) {
    const existingPlan = await prisma.membershipPlan.findFirst({ where: { name: p.name } });
    if (!existingPlan) {
      await prisma.membershipPlan.create({
        data: { ...p, branchId: PRIMARY_BRANCH_ID },
      });
      console.log(`✅ Seeded plan: ${p.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
