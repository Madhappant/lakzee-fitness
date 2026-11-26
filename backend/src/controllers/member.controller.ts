import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../app';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const createMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional()
});

const updateMemberSchema = z.object({
  memberId: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(6).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().optional(),
  bloodGroup: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional()
});

const parseOptionalDate = (val?: string): Date | null | undefined => {
  if (val === undefined) return undefined;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date format');
  }
  return d;
};

export const createMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createMemberSchema.parse(req.body);
    const { email, password, firstName, lastName, phone, ...profileData } = validatedData;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'Email already exists' });
    }

    let parsedDob: Date | null | undefined;
    try {
      parsedDob = parseOptionalDate(profileData.dob);
    } catch {
      return res.status(400).json({ status: 'error', message: 'Invalid date of birth' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate collision-safe unique member ID
    let memberId = `LZ-${Math.floor(1000 + Math.random() * 9000)}`;
    let foundUnique = false;
    for (let attempts = 0; attempts < 20; attempts++) {
      const existing = await prisma.memberProfile.findUnique({ where: { memberId } });
      if (!existing) {
        foundUnique = true;
        break;
      }
      memberId = `LZ-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    if (!foundUnique) {
      memberId = `LZ-${Date.now().toString().slice(-6)}`;
    }

    let photoUrl: string | undefined = undefined;
    if (req.file) {
      if ((process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) && req.file.path.startsWith('http')) {
        photoUrl = req.file.path;
      } else {
        photoUrl = `/uploads/${req.file.filename}`;
      }
    }

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
            dob: parsedDob ?? undefined
          }
        }
      },
      include: {
        memberProfile: true
      },
      omit: { password: true }
    });

    memoryCache.delete('dashboard_stats');
    res.status(201).json({ status: 'success', data: newMember });
  } catch (error) {
    next(error);
  }
};

import { memoryCache } from '../utils/cache';

export const getMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await prisma.user.findMany({
      where: { role: 'MEMBER' },
      include: { 
        memberProfile: {
          include: {
            subscriptions: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              include: { plan: { select: { id: true, name: true, price: true } } }
            }
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

    const existing = await prisma.user.findUnique({
      where: { id },
      include: { memberProfile: true }
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Member not found' });
    }

    // Perform full cascading delete atomically in a single transaction
    await prisma.$transaction(async (tx) => {
      const profile = existing.memberProfile;

      if (profile) {
        const invoices = await tx.invoice.findMany({ where: { memberId: profile.id } });
        const invoiceIds = invoices.map((i) => i.id);

        if (invoiceIds.length > 0) {
          await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        }
        await tx.invoice.deleteMany({ where: { memberId: profile.id } });
        await tx.subscription.deleteMany({ where: { memberId: profile.id } });
        await tx.attendance.deleteMany({ where: { memberId: profile.id } });
        await tx.dietPlan.deleteMany({ where: { memberId: profile.id } });
        await tx.workoutRoutine.deleteMany({ where: { memberId: profile.id } });
      }

      // Detach trainer assignments and clean up authored announcements before deleting user
      await tx.memberProfile.updateMany({ where: { trainerId: id }, data: { trainerId: null } });
      await tx.announcement.deleteMany({ where: { authorId: id } });
      await tx.user.delete({ where: { id } });
    });

    memoryCache.delete('dashboard_stats');

    res.json({ status: 'success', message: 'Member deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const validatedData = updateMemberSchema.parse(req.body);
    const { firstName, lastName, phone, email, password, memberId, ...profileData } = validatedData;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ 
      where: { id },
      include: { memberProfile: true }
    });
    
    if (!existingUser) {
      return res.status(404).json({ status: 'error', message: 'Member not found' });
    }

    let parsedDob: Date | null | undefined;
    try {
      parsedDob = parseOptionalDate(profileData.dob);
    } catch {
      return res.status(400).json({ status: 'error', message: 'Invalid date of birth' });
    }

    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail && existingEmail.id !== id) {
        return res.status(400).json({ status: 'error', message: 'Email already exists' });
      }
    }

    if (memberId) {
      const trimmedMemberId = memberId.trim();
      const existingProfile = await prisma.memberProfile.findUnique({
        where: { memberId: trimmedMemberId }
      });
      if (existingProfile && existingProfile.userId !== id) {
        return res.status(400).json({ status: 'error', message: 'Member No. already exists. Please choose a unique Member No.' });
      }
    }

    const profileUpdateFields: any = {
      ...profileData,
      ...(memberId ? { memberId: memberId.trim() } : {}),
    };
    if (parsedDob !== undefined) {
      profileUpdateFields.dob = parsedDob;
    }

    if (req.file) {
      const pUrl = ((process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) && req.file.path.startsWith('http'))
        ? req.file.path
        : `/uploads/${req.file.filename}`;
      profileUpdateFields.photoUrl = pUrl;
    }

    const updateData: any = {
      firstName,
      lastName,
      phone,
    };

    if (existingUser.memberProfile) {
      updateData.memberProfile = { update: profileUpdateFields };
    } else if (memberId || Object.keys(profileUpdateFields).length > 0) {
      updateData.memberProfile = {
        create: {
          memberId: memberId ? memberId.trim() : `LZ-${Date.now().toString().slice(-6)}`,
          ...profileUpdateFields,
        },
      };
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

    memoryCache.delete('dashboard_stats');

    res.json({ status: 'success', data: updatedMember });
  } catch (error) {
    next(error);
  }
};
