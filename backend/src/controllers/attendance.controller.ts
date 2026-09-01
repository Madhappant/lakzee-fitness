import { Request, Response } from 'express';
import { prisma } from '../app';

export const checkIn = async (req: Request, res: Response) => {
  try {
    const { lakzeeId } = req.body; // e.g. LZ-1234
    
    // Find member by Lakzee ID, QR Code UUID, or Name
    const members = await prisma.memberProfile.findMany({
      where: {
        OR: [
          { memberId: lakzeeId },
          { qrCode: lakzeeId.toLowerCase() },
          { user: { firstName: { contains: lakzeeId, mode: 'insensitive' } } },
          { user: { lastName: { contains: lakzeeId, mode: 'insensitive' } } }
        ]
      },
      include: { user: true }
    });

    if (members.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Member not found' });
    }

    if (members.length > 1) {
      return res.status(400).json({ status: 'error', message: 'Multiple members found. Please use exact ID or scan QR.' });
    }

    const member = members[0];

    // Check if member has an active subscription
    const activeSub = await prisma.subscription.findFirst({
      where: {
        memberId: member.id,
        status: 'ACTIVE'
      }
    });

    if (!activeSub) {
      return res.status(403).json({ status: 'error', message: 'Member does not have an active subscription' });
    }

    // Check if member is already checked in and not checked out
    const existingCheckIn = await prisma.attendance.findFirst({
      where: {
        memberId: member.id,
        checkOut: null
      }
    });

    if (existingCheckIn) {
      return res.status(400).json({ status: 'error', message: 'Member is already checked in and has not checked out' });
    }

    // Create checkin record
    const attendance = await prisma.attendance.create({
      data: {
        memberId: member.id,
        date: new Date(),
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
    const { start, end } = req.query;
    
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    if (start) {
      startDate = new Date(start as string);
    }

    const whereClause: any = {
      checkIn: {
        gte: startDate,
      }
    };

    if (end) {
      whereClause.checkIn.lte = new Date(end as string);
    }

    const logs = await prisma.attendance.findMany({
      where: whereClause,
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
export const checkOut = async (req: Request, res: Response) => {
  try {
    const { lakzeeId } = req.body;
    
    const members = await prisma.memberProfile.findMany({
      where: {
        OR: [
          { memberId: lakzeeId },
          { qrCode: lakzeeId.toLowerCase() },
          { user: { firstName: { contains: lakzeeId, mode: 'insensitive' } } },
          { user: { lastName: { contains: lakzeeId, mode: 'insensitive' } } }
        ]
      },
      include: { user: true }
    });

    if (members.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Member not found' });
    }
    if (members.length > 1) {
      return res.status(400).json({ status: 'error', message: 'Multiple members found. Please use exact ID or scan QR.' });
    }

    const member = members[0];

    const existingCheckIn = await prisma.attendance.findFirst({
      where: {
        memberId: member.id,
        checkOut: null
      },
      orderBy: { checkIn: 'desc' }
    });

    if (!existingCheckIn) {
      return res.status(400).json({ status: 'error', message: 'Member is not checked in or already checked out' });
    }

    const attendance = await prisma.attendance.update({
      where: { id: existingCheckIn.id },
      data: { checkOut: new Date() }
    });

    res.json({ 
      status: 'success', 
      message: `Checked out ${member.user.firstName} ${member.user.lastName}`,
      data: attendance 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Check-out failed' });
  }
};
