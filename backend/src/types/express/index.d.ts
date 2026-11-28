/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TenantScope } from '../../utils/tenant';

declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: string;
        role: string;
        branchId: string;
      };
      tenant?: TenantScope;
      validated?: {
        body?: any;
        query?: any;
        params?: any;
      };
      rawBody?: Buffer;
    }
  }
}

export {};
