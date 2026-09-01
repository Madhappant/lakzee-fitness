
const fs = require('fs');
let code = fs.readFileSync('backend/src/controllers/attendance.controller.ts', 'utf8');

// Allow PENDING payments to check in
code = code.replace(
  /paymentStatus: 'PAID'/g,
  \status: 'ACTIVE'\
);
code = code.replace(
  /message: 'Member does not have an active, paid subscription'/g,
  \message: 'Member does not have an active subscription'\
);

// Allow multiple checkins if checked out
code = code.replace(
  /const existingCheckIn = await prisma\\.attendance\\.findFirst\\(\\{\\s*where: \\{\\s*memberId: member\\.id,\\s*date: todayStart\\s*\\}\\s*\\}\\);\\s*if \\(existingCheckIn\\) \\{\\s*return res\\.status\\(400\\)\\.json\\(\\{ status: 'error', message: 'Member is already checked in for today' \\}\\);\\s*\\}/,
  \const existingCheckIn = await prisma.attendance.findFirst({
      where: {
        memberId: member.id,
        date: todayStart,
        checkOut: null
      }
    });

    if (existingCheckIn) {
      return res.status(400).json({ status: 'error', message: 'Member is already checked in and has not checked out' });
    }\
);

fs.writeFileSync('backend/src/controllers/attendance.controller.ts', code);
console.log('patched attendance logic');

