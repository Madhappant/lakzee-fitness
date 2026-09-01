
const fs = require('fs');
let code = fs.readFileSync('src/routes/member.routes.ts', 'utf8');

code = code.replace(
  /import \{ authenticate, authorize \} from '\.\.\/middlewares\/auth\.middleware';/,
  \import { authenticate, authorize } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';\
);

code = code.replace(
  /router\.post\('\/', authorize\('ADMIN', 'RECEPTIONIST'\), createMember\);/,
  \outer.post('/', authorize('ADMIN', 'RECEPTIONIST'), upload.single('photo'), createMember);\
);

code = code.replace(
  /router\.put\('\/:id', authorize\('ADMIN', 'RECEPTIONIST'\), updateMember\);/,
  \outer.put('/:id', authorize('ADMIN', 'RECEPTIONIST'), upload.single('photo'), updateMember);\
);

fs.writeFileSync('src/routes/member.routes.ts', code);
console.log('Patched member.routes.ts');

