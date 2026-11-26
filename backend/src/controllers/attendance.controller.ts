import { Request, Response } from 'express';
import { prisma } from '../app';
import { memoryCache } from '../utils/cache';

async function findMemberByIdentifier(sanitizedId: string) {
  // 1. Prioritize exact match on Member ID or QR Code UUID to avoid partial-name collisions
  const exactMatches = await prisma.memberProfile.findMany({
    where: {
      OR: [
        { memberId: { equals: sanitizedId, mode: 'insensitive' } },
        { qrCode: { equals: sanitizedId, mode: 'insensitive' } },
      ],
    },
    include: { user: true },
  });

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // 2. Fallback to name search (requires >= 2 characters to avoid overly broad matches)
  if (sanitizedId.length < 2) {
    return [];
  }

  return prisma.memberProfile.findMany({
    where: {
      OR: [
        { user: { firstName: { contains: sanitizedId, mode: 'insensitive' } } },
        { user: { lastName: { contains: sanitizedId, mode: 'insensitive' } } },
      ],
    },
    include: { user: true },
  });
}

export const checkIn = async (req: Request, res: Response) => {
  try {
    const { lakzeeId } = req.body; // e.g. LZ-1234

    if (!lakzeeId || typeof lakzeeId !== 'string' || !lakzeeId.trim()) {
      return res.status(400).json({ status: 'error', message: 'Member ID or QR code is required' });
    }
    const sanitizedId = lakzeeId.trim();

    const members = await findMemberByIdentifier(sanitizedId);

    if (members.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Member not found' });
    }

    if (members.length > 1) {
      return res.status(400).json({ status: 'error', message: 'Multiple members found. Please use exact ID or scan QR.' });
    }

    const member = members[0];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Check if member has an active AND non-expired subscription
    const activeSub = await prisma.subscription.findFirst({
      where: {
        memberId: member.id,
        status: 'ACTIVE',
        endDate: { gte: startOfToday },
      },
    });

    if (!activeSub) {
      return res.status(403).json({ status: 'error', message: 'Member does not have an active non-expired subscription' });
    }

    // Check if member is already checked in and not checked out
    const existingCheckIn = await prisma.attendance.findFirst({
      where: {
        memberId: member.id,
        checkOut: null,
      },
      orderBy: { checkIn: 'desc' },
    });

    if (existingCheckIn) {
      const now = new Date();
      const diffHours = (now.getTime() - new Date(existingCheckIn.checkIn).getTime()) / (1000 * 60 * 60);

      // If check-in was within the last 16 hours, consider it an active ongoing workout session
      if (diffHours < 16) {
        return res.status(400).json({ status: 'error', message: 'Member is already checked in and has not checked out' });
      } else {
        // Auto-close forgotten session from previous day so member is never permanently locked out
        const autoCheckOut = new Date(new Date(existingCheckIn.checkIn).getTime() + 2 * 60 * 60 * 1000);
        await prisma.attendance.update({
          where: { id: existingCheckIn.id },
          data: { checkOut: autoCheckOut },
        });
      }
    }

    // Create checkin record
    const attendance = await prisma.attendance.create({
      data: {
        memberId: member.id,
        date: new Date(),
      },
    });

    memoryCache.delete('dashboard_stats');

    res.status(201).json({
      status: 'success',
      message: `Checked in ${member.user.firstName} ${member.user.lastName}`,
      data: attendance,
    });
  } catch {
    res.status(500).json({ status: 'error', message: 'Check-in failed' });
  }
};

export const getTodayAttendance = async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;

    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (start) {
      const parsedStart = new Date(start as string);
      if (isNaN(parsedStart.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Invalid start date' });
      }
      startDate = parsedStart;
    }

    const whereClause: any = {
      checkIn: {
        gte: startDate,
      },
    };

    if (end) {
      const parsedEnd = new Date(end as string);
      if (isNaN(parsedEnd.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Invalid end date' });
      }
      whereClause.checkIn.lte = parsedEnd;
    }

    const logs = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        member: {
          include: { user: true },
        },
      },
      orderBy: { checkIn: 'desc' },
    });

    res.json({ status: 'success', data: logs });
  } catch {
    res.status(500).json({ status: 'error', message: 'Failed to fetch attendance logs' });
  }
};

export const checkOut = async (req: Request, res: Response) => {
  try {
    const { lakzeeId } = req.body;

    if (!lakzeeId || typeof lakzeeId !== 'string' || !lakzeeId.trim()) {
      return res.status(400).json({ status: 'error', message: 'Member ID or QR code is required' });
    }
    const sanitizedId = lakzeeId.trim();

    const members = await findMemberByIdentifier(sanitizedId);

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
        checkOut: null,
      },
      orderBy: { checkIn: 'desc' },
    });

    if (!existingCheckIn) {
      return res.status(400).json({ status: 'error', message: 'Member is not checked in or already checked out' });
    }

    const attendance = await prisma.attendance.update({
      where: { id: existingCheckIn.id },
      data: { checkOut: new Date() },
    });

    memoryCache.delete('dashboard_stats');

    res.json({
      status: 'success',
      message: `Checked out ${member.user.firstName} ${member.user.lastName}`,
      data: attendance,
    });
  } catch {
    res.status(500).json({ status: 'error', message: 'Check-out failed' });
  }
};
