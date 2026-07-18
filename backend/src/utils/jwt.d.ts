import { User } from '@prisma/client';
export declare const generateToken: (user: User) => never;
export declare const verifyToken: (token: string) => {
    id: string;
    role: string;
};
//# sourceMappingURL=jwt.d.ts.map