
const fs = require('fs');
let code = fs.readFileSync('src/controllers/member.controller.ts', 'utf8');

code = code.replace(
  /const updateMemberSchema = z\.object\(\{[\\s\\S]*?\}\);/,
  \const updateMemberSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional()
});\
);

code = code.replace(
  /export const updateMember = async \\(req: Request, res: Response, next: NextFunction\\) => \\{[\\s\\S]*?const \\{ firstName, lastName, phone, \.\.\.profileData \\} = validatedData;/m,
  \export const updateMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const validatedData = updateMemberSchema.parse(req.body);
    const { firstName, lastName, phone, email, password, ...profileData } = validatedData;\
);

code = code.replace(
  /const updatedMember = await prisma\.user\.update\(\{[\\s\\S]*?where: \{ id \},[\\s\\S]*?data: \{[\\s\\S]*?firstName,[\\s\\S]*?lastName,[\\s\\S]*?phone,[\\s\\S]*?memberProfile: \{[\\s\\S]*?update: \{[\\s\\S]*?\.\.\.profileData,[\\s\\S]*?dob: profileData\.dob \? new Date\(profileData\.dob\) : undefined[\\s\\S]*?\}[\\s\\S]*?\}[\\s\\S]*?\}[\\s\\S]*?\}\);/m,
  \if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail && existingEmail.id !== id) {
        return res.status(400).json({ status: 'error', message: 'Email already exists' });
      }
    }

    let updateData: any = {
      firstName,
      lastName,
      phone,
      memberProfile: {
        update: {
          ...profileData,
          dob: profileData.dob ? new Date(profileData.dob) : undefined
        }
      }
    };
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const updatedMember = await prisma.user.update({
      where: { id },
      data: updateData
    });\
);

fs.writeFileSync('src/controllers/member.controller.ts', code);
console.log('Patched member.controller.ts');

