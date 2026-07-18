import { Request, Response } from 'express';
import { prisma } from '../app';
import bcrypt from 'bcryptjs';

export const createMember = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone, ...profileData } = req.body;

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
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to create member' });
  }
};

export const getMembers = async (req: Request, res: Response) => {
  try {
    const members = await prisma.user.findMany({
      where: { role: 'MEMBER' },
      include: { memberProfile: true }
    });
    res.json({ status: 'success', data: members });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch members' });
  }
};

export const getMemberById = async (req: Request, res: Response) => {
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
    res.status(500).json({ status: 'error', message: 'Failed to fetch member' });
  }
};

export const deleteMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // User deletion will cascade and delete the MemberProfile due to the schema relation
    await prisma.user.delete({
      where: { id }
    });

    res.json({ status: 'success', message: 'Member deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to delete member' });
  }
};

export const updateMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, ...profileData } = req.body;

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
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to update member' });
  }
};
