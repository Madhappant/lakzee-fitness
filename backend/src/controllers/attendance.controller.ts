import { Request, Response } from 'express';
import { prisma } from '../app';

export const checkIn = async (req: Request, res: Response) => {
  try {
    const { lakzeeId } = req.body; // e.g. LZ-1234
    
    // Find member by Lakzee ID
    const member = await prisma.memberProfile.findUnique({
      where: { memberId: lakzeeId },
      include: { user: true }
    });

    if (!member) {
      return res.status(404).json({ status: 'error', message: 'Member not found' });
    }

    // Check if member has an active subscription
    const activeSub = await prisma.subscription.findFirst({
      where: {
        memberId: member.id,
        status: 'ACTIVE',
        paymentStatus: 'PAID'
      }
    });

    if (!activeSub) {
      return res.status(403).json({ status: 'error', message: 'Member does not have an active, paid subscription' });
    }

    // Check if already checked in today
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const existingCheckIn = await prisma.attendance.findFirst({
      where: {
        memberId: member.id,
        date: todayStart
      }
    });

    if (existingCheckIn) {
      return res.status(400).json({ status: 'error', message: 'Member is already checked in for today' });
    }

    // Create checkin record
    const attendance = await prisma.attendance.create({
      data: {
        memberId: member.id,
        date: new Date(new Date().setHours(0, 0, 0, 0)), // Normalize to start of day
      }
    });

    res.status(201).json({ 
      status: 'success', 
      message: `Checked in ${member.user.firstName} ${member.user.lastName}`,
      data: attendance 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Check-in failed' });
  }
};

export const getTodayAttendance = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = await prisma.attendance.findMany({
      where: {
        date: {
          gte: today,
        }
      },
      include: {
        member: {
          include: { user: true }
        }
      },
      orderBy: { checkIn: 'desc' }
    });
    
    res.json({ status: 'success', data: logs });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch attendance logs' });
  }
};
