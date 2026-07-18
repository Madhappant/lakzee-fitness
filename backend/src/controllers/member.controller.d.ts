import { Request, Response } from 'express';
export declare const createMember: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMembers: (req: Request, res: Response) => Promise<void>;
export declare const getMemberById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteMember: (req: Request, res: Response) => Promise<void>;
export declare const updateMember: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=member.controller.d.ts.map