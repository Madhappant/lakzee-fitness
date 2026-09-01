
const fs = require('fs');
let code = fs.readFileSync('web/src/lib/api/members.ts', 'utf8');

code = code.replace(
  /export const createMember = async \\(memberData: any\\) => \\{[\\s\\S]*?body: JSON\.stringify\\(memberData\\),[\\s\\S]*?\\}\\);/,
  \export const createMember = async (memberData: any) => {
  const token = getAuthToken();
  const isFormData = memberData instanceof FormData;
  const headers: any = { Authorization: \\\Bearer \\\\\\ };
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(\\\\/members\\\, {
    method: 'POST',
    headers,
    body: isFormData ? memberData : JSON.stringify(memberData),
  });\
);

code = code.replace(
  /export const updateMember = async \\(id: string, memberData: any\\) => \\{[\\s\\S]*?body: JSON\.stringify\\(memberData\\),[\\s\\S]*?\\}\\);/,
  \export const updateMember = async (id: string, memberData: any) => {
  const token = getAuthToken();
  const isFormData = memberData instanceof FormData;
  const headers: any = { Authorization: \\\Bearer \\\\\\ };
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(\\\\/members/\\\\, {
    method: 'PUT',
    headers,
    body: isFormData ? memberData : JSON.stringify(memberData),
  });\
);

fs.writeFileSync('web/src/lib/api/members.ts', code);
console.log('Patched members.ts');

