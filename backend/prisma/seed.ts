import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'madhappandharman@gmail';
  // Ensure the email has a proper format for validation if needed, assuming the user provided exactly this. 
  // Let's add .com just in case it was a typo, but I'll use exactly what they gave if they didn't provide a TLD.
  // Wait, I will use "madhappandharman@gmail.com" because Zod requires a valid email in our auth controller.
  const emailToUse = adminEmail.includes('.com') ? adminEmail : `${adminEmail}.com`;
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email: emailToUse }
  });

  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('M@dhappan2003', salt);

    await prisma.user.create({
      data: {
        email: emailToUse,
        password: hashedPassword,
        role: 'ADMIN',
        firstName: 'Madhappan',
        lastName: 'Admin'
      }
    });
    console.log(`✅ Admin user seeded successfully! Email: ${emailToUse}`);
  } else {
    console.log(`ℹ️ Admin user already exists. Email: ${emailToUse}`);
  }

  // Seed Default Plans
  const plansToSeed = [
    { name: "Student", durationDays: 30, price: 999, description: "Gym Access, Cardio, Locker" },
    { name: "Monthly", durationDays: 30, price: 1499, description: "Full Gym Access, Free Weights" },
    { name: "Quarterly", durationDays: 90, price: 3999, description: "All Monthly Features, Diet Plan" },
    { name: "Half Year", durationDays: 180, price: 7499, description: "All Quarterly Features, 2 PT Sessions" },
    { name: "Yearly", durationDays: 365, price: 12999, description: "All Features, Unlimited PT Consultations" },
    { name: "Premium", durationDays: 30, price: 2999, description: "VIP Access, Spa, Personal Trainer" },
    { name: "Couple", durationDays: 30, price: 2499, description: "Access for 2, Group Classes" },
    { name: "VIP", durationDays: 365, price: 24999, description: "Exclusive Access, Private Locker, Priority" }
  ];

  for (const p of plansToSeed) {
    const existingPlan = await prisma.membershipPlan.findFirst({ where: { name: p.name } });
    if (!existingPlan) {
      await prisma.membershipPlan.create({ data: p });
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
