import { Request, Response, NextFunction } from 'express';
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
            dob: profileData.dob ? new Date(profileData.dob) : undefined
          }
        }
      },
      include: {
        memberProfile: true
      }
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
      include: { memberProfile: true }
    });
    res.json({ status: 'success', data: members });
  } catch (error) {
    next(error);
  }
};

export const getMemberById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const member = await prisma.user.findUnique({
      where: { id },
      include: { memberProfile: true, assignedMembers: true }
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
    const { id } = req.params;
    
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
    const { id } = req.params;
    const validatedData = updateMemberSchema.parse(req.body);
    const { firstName, lastName, phone, ...profileData } = validatedData;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ 
      where: { id },
      include: { memberProfile: true }
    });
    
    if (!existingUser) {
      return res.status(404).json({ status: 'error', message: 'Member not found' });
    }

    const updatedMember = await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        phone,
        memberProfile: {
          update: {
            ...profileData,
            dob: profileData.dob ? new Date(profileData.dob) : undefined
          }
        }
      },
      include: {
        memberProfile: true
      }
    });

    res.json({ status: 'success', data: updatedMember });
  } catch (error) {
    next(error);
  }
};
