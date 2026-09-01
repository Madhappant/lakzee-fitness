
const fs = require('fs');
let code = fs.readFileSync('backend/src/controllers/attendance.controller.ts', 'utf8');

const checkoutFn = \
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
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

    const existingCheckIn = await prisma.attendance.findFirst({
      where: {
        memberId: member.id,
        date: todayStart,
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
      message: \\\Checked out \\\ \\\\\\,
      data: attendance 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Check-out failed' });
  }
};
\;

code += '\\n' + checkoutFn;
fs.writeFileSync('backend/src/controllers/attendance.controller.ts', code);

// Update routes
let routes = fs.readFileSync('backend/src/routes/attendance.routes.ts', 'utf8');
routes = routes.replace(
  /import \{ checkIn, getTodayAttendance \} from '\.\.\/controllers\/attendance\.controller';/,
  \\import { checkIn, checkOut, getTodayAttendance } from '../controllers/attendance.controller';\\
);
routes = routes.replace(
  /router\.post\('\\/checkin', authorize\('ADMIN', 'RECEPTIONIST'\), checkIn\);/,
  \\outer.post('/checkin', authorize('ADMIN', 'RECEPTIONIST'), checkIn);\\nrouter.post('/checkout', authorize('ADMIN', 'RECEPTIONIST'), checkOut);\\
);
fs.writeFileSync('backend/src/routes/attendance.routes.ts', routes);
console.log('patched backend');

