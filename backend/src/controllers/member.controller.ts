import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../app';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const createMemberSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional()
});

const updateMemberSchema = z.object({
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
});
export const createMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createMemberSchema.parse(req.body);
    const { email, password, firstName, lastName, phone, ...profileData } = validatedData;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const memberId = `LZ-${Math.floor(1000 + Math.random() * 9000)}`;
    const photoUrl = req.file ? req.file.path : undefined;

    const newMember = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: 'MEMBER',
        memberProfile: {
          create: {
            memberId,
            ...profileData,
            photoUrl,
            dob: profileData.dob ? new Date(profileData.dob) : undefined
          }
        }
      },
      include: {
        memberProfile: true
      },
      omit: { password: true }
    });

    res.status(201).json({ status: 'success', data: newMember });
  } catch (error) {
    next(error);
  }
};

export const getMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await prisma.user.findMany({
      where: { role: 'MEMBER' },
      include: { 
        memberProfile: {
          include: {
            subscriptions: true
          }
        } 
      },
      omit: { password: true }
    });
    res.json({ status: 'success', data: members });
  } catch (error) {
    next(error);
  }
};

export const getMemberById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    if (req.user?.role === 'MEMBER' && req.user.id !== id) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: You can only view your own profile' });
    }

    const member = await prisma.user.findUnique({
      where: { id },
      include: { memberProfile: true, assignedMembers: true },
      omit: { password: true }
    });

    if (!member) {
      return res.status(404).json({ status: 'error', message: 'Member not found' });
    }
    res.json({ status: 'success', data: member });
  } catch (error) {
    next(error);
  }
};

export const deleteMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    
    const profile = await prisma.memberProfile.findUnique({ where: { userId: id } });
    
    if (profile) {
      // Find invoices to delete associated payments first
      const invoices = await prisma.invoice.findMany({ where: { memberId: profile.id } });
      const invoiceIds = invoices.map((i: any) => i.id);

      // Perform manual cascading deletes in a transaction
      await prisma.$transaction([
        prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } }),
        prisma.invoice.deleteMany({ where: { memberId: profile.id } }),
        prisma.subscription.deleteMany({ where: { memberId: profile.id } }),
        prisma.attendance.deleteMany({ where: { memberId: profile.id } }),
        prisma.dietPlan.deleteMany({ where: { memberId: profile.id } }),
        prisma.workoutRoutine.deleteMany({ where: { memberId: profile.id } })
      ]);
    }

    // User deletion will cascade and delete the MemberProfile due to the schema relation
    await prisma.user.delete({
      where: { id }
    });

    res.json({ status: 'success', message: 'Member deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const validatedData = updateMemberSchema.parse(req.body);
    const { firstName, lastName, phone, email, password, ...profileData } = validatedData;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ 
      where: { id },
      include: { memberProfile: true }
    });
    
    if (!existingUser) {
      return res.status(404).json({ status: 'error', message: 'Member not found' });
    }

    if (email) {
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

    if (req.file) {
      updateData.memberProfile.update.photoUrl = req.file.path;
    }

    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const updatedMember = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        memberProfile: true
      },
      omit: { password: true }
    });

    res.json({ status: 'success', data: updatedMember });
  } catch (error) {
    next(error);
  }
};
