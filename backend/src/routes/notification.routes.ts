import { Router } from 'express';
import { prisma } from '../app';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, async (req: any, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    const notifications: any[] = [];
    
    // Calculate 3 days from now for expiry warnings
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    if (userRole === 'ADMIN' || userRole === 'RECEPTIONIST') {
      // ADMIN NOTIFICATIONS

      // 1. Pending Payments
      const pendingInvoices = await prisma.invoice.findMany({
        where: { status: 'PENDING' },
        include: { member: { include: { user: true } } },
        orderBy: { createdAt: 'desc' }
      });

      pendingInvoices.forEach(invoice => {
        notifications.push({
          id: `inv-${invoice.id}`,
          type: 'PAYMENT',
          title: 'Pending Payment',
          message: `${invoice.member.user.firstName} ${invoice.member.user.lastName} has a pending invoice of ₹${invoice.totalAmount}.`,
          date: invoice.createdAt,
          link: `/admin/payments`,
          read: false
        });
      });

      // 2. Expiring / Expired Subscriptions
      const expiringSubscriptions = await prisma.subscription.findMany({
        where: {
          endDate: { lte: threeDaysFromNow },
          status: { notIn: ['CANCELLED', 'FROZEN'] } // ACTIVE or already EXPIRED
        },
        include: { member: { include: { user: true } }, plan: true },
        orderBy: { endDate: 'asc' }
      });

      expiringSubscriptions.forEach(sub => {
        const isExpired = sub.endDate < now;
        notifications.push({
          id: `sub-${sub.id}`,
          type: 'EXPIRY',
          title: isExpired ? 'Membership Expired' : 'Membership Expiring Soon',
          message: `${sub.member.user.firstName} ${sub.member.user.lastName}'s ${sub.plan.name} plan ${isExpired ? 'expired on' : 'will expire on'} ${sub.endDate.toLocaleDateString()}.`,
          date: sub.endDate,
          link: `/admin/members/${sub.member.id}/plan`,
          read: false
        });
      });

    } else if (userRole === 'MEMBER') {
      // MEMBER NOTIFICATIONS
      
      const memberProfile = await prisma.memberProfile.findUnique({
        where: { userId }
      });

      if (memberProfile) {
        // 1. My Pending Payments
        const myPendingInvoices = await prisma.invoice.findMany({
          where: { memberId: memberProfile.id, status: 'PENDING' },
          orderBy: { createdAt: 'desc' }
        });

        myPendingInvoices.forEach(invoice => {
          notifications.push({
            id: `inv-${invoice.id}`,
            type: 'PAYMENT',
            title: 'Pending Payment',
            message: `You have a pending invoice of ₹${invoice.totalAmount}. Please complete your payment.`,
            date: invoice.createdAt,
            link: `/member/dashboard`, // Or somewhere specific for member payments if it existed
            read: false
          });
        });

        // 2. My Expiring Subscriptions
        const myExpiringSubscriptions = await prisma.subscription.findMany({
          where: {
            memberId: memberProfile.id,
            endDate: { lte: threeDaysFromNow },
            status: { notIn: ['CANCELLED', 'FROZEN'] }
          },
          include: { plan: true },
          orderBy: { endDate: 'asc' }
        });

        myExpiringSubscriptions.forEach(sub => {
          const isExpired = sub.endDate < now;
          notifications.push({
            id: `sub-${sub.id}`,
            type: 'EXPIRY',
            title: isExpired ? 'Membership Expired' : 'Membership Expiring Soon',
            message: `Your ${sub.plan.name} plan ${isExpired ? 'expired on' : 'will expire on'} ${sub.endDate.toLocaleDateString()}. Please renew it to continue accessing the gym.`,
            date: sub.endDate,
            link: `/member/subscriptions`,
            read: false
          });
        });
      }
    }

    // Sort all notifications by date (newest first for payments, and closest expiry first?)
    // Actually, sorting by date descending is fine for payments, but for expiry, maybe we want most recent expiries first.
    notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.status(200).json({
      status: 'success',
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch notifications' });
  }
});

export default router;
