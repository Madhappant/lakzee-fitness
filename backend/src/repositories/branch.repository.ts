import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
import {
  PRIMARY_BRANCH_CODE,
  PRIMARY_BRANCH_ID,
  PRIMARY_BRANCH_LOCATION,
  PRIMARY_BRANCH_NAME,
} from '../utils/tenant';

export class BranchRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listBranches() {
    if (!(this.db as unknown as { branch?: typeof this.db.branch }).branch) {
      return [
        {
          id: PRIMARY_BRANCH_ID,
          name: PRIMARY_BRANCH_NAME,
          code: PRIMARY_BRANCH_CODE,
          location: PRIMARY_BRANCH_LOCATION,
          status: 'ACTIVE',
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ];
    }

    return this.db.branch.findMany({
      orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
    });
  }

  findBranchById(id: string) {
    return this.db.branch.findUnique({ where: { id } });
  }

  findBranchByCodeOrName(code: string, name: string) {
    return this.db.branch.findFirst({
      where: {
        OR: [
          { code: { equals: code, mode: 'insensitive' } },
          { name: { equals: name, mode: 'insensitive' } },
        ],
      },
    });
  }

  createBranch(data: { name: string; code: string; location: string; status?: string }) {
    return this.db.branch.create({
      data: {
        name: data.name,
        code: data.code,
        location: data.location,
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  updateBranch(id: string, data: Partial<{ name: string; code: string; location: string; status: string }>) {
    return this.db.branch.update({
      where: { id },
      data,
    });
  }
}

export const branchRepository = new BranchRepository();
