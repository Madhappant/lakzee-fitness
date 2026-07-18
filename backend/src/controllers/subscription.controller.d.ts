import { Request, Response } from 'express';
export declare const createSubscription: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getSubscriptions: (req: Request, res: Response) => Promise<void>;
export declare const getPaymentStats: (req: Request, res: Response) => Promise<void>;
export declare const updateSubscription: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteSubscription: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=subscription.controller.d.ts.map