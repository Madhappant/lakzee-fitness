import { Router } from 'express';
import { prisma } from '../app';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { z } from 'zod';

const router = Router();

// Schema for creating announcements
const createAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  message: z.string().min(1, 'Message is required').max(1000)
});

// GET /api/announcements - Fetch all announcements
router.get('/', authenticate, async (req: any, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const announcements = await prisma.announcement.findMany({
      where: {
        createdAt: {
          gte: todayStart
        }
      },
      include: {
        author: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json({ status: 'success', data: announcements });
  } catch (error) {
    next(error);
  }
});

// POST /api/announcements - Create a new announcement
router.post('/', authenticate, authorize('ADMIN', 'RECEPTIONIST'), async (req: any, res, next) => {
  try {
    const { title, message } = createAnnouncementSchema.parse(req.body);
    const authorId = req.user.id;

    const announcement = await prisma.announcement.create({
      data: {
        title,
        message,
        authorId
      },
      include: {
        author: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    res.status(201).json({ status: 'success', data: announcement });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/announcements/:id - Delete an announcement
router.delete('/:id', authenticate, authorize('ADMIN', 'RECEPTIONIST'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.announcement.delete({
      where: { id }
    });
    res.status(200).json({ status: 'success', message: 'Announcement deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
