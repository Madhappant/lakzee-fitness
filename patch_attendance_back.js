
const fs = require('fs');
let code = fs.readFileSync('backend/src/controllers/attendance.controller.ts', 'utf8');

code = code.replace(
  /const member \= await prisma\.memberProfile\.findFirst\(\{\\s*where: \{\\s*OR: \[\\s*\{ memberId: lakzeeId \},\\s*\{ qrCode: lakzeeId\.toLowerCase\(\) \}\\s*\]\\s*\},\\s*include: \{ user: true \}\\s*\}\);\\s*if \(\!member\) \{\\s*return res\.status\(404\)\.json\(\{ status: 'error', message: 'Member not found' \}\);\\s*\}/,
  \const members = await prisma.memberProfile.findMany({
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

      const member = members[0];\
);

fs.writeFileSync('backend/src/controllers/attendance.controller.ts', code);
console.log('patched');

