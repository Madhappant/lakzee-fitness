import { Request, Response } from 'express';
export declare const getStaff: (req: Request, res: Response) => Promise<void>;
export declare const assignRole: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const revokeRole: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=staff.controller.d.ts.map