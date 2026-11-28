import { MemberRepository, memberRepository } from '../repositories/member.repository';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { assertBranchOwnership, type TenantScope } from '../utils/tenant';

export class PortalRoutineService {
  constructor(private readonly repo: MemberRepository = memberRepository) {}

  async getMyProfile(userId?: string) {
    if (!userId) throw new UnauthorizedError('Unauthorized');
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const memberProfile = await this.repo.findPortalProfile(userId, startOfToday);
    if (!memberProfile) throw new NotFoundError('Member profile not found');
    return memberProfile;
  }

  async getMyAttendance(userId?: string) {
    if (!userId) throw new UnauthorizedError('Unauthorized');
    const profile = await this.repo.findProfileIdByUserId(userId);
    if (!profile) throw new NotFoundError('Member not found');
    return this.repo.listMemberAttendance(profile.id, 30);
  }

  async getMySubscriptions(userId?: string) {
    if (!userId) throw new UnauthorizedError('Unauthorized');
    const profile = await this.repo.findProfileIdByUserId(userId);
    if (!profile) throw new NotFoundError('Member not found');
    return this.repo.listMemberSubscriptions(profile.id);
  }

  async updateMyPhoto(userId: string | undefined, file?: Express.Multer.File) {
    if (!userId) throw new UnauthorizedError('Unauthorized');
    if (!file) throw new Error('No file uploaded');

    const profile = await this.repo.findProfileIdByUserId(userId);
    if (!profile) throw new NotFoundError('Member not found');

    const photoUrl =
      (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) && file.path
        ? file.path
        : `/uploads/${file.filename}`;

    return this.repo.updateMemberPhoto(userId, photoUrl);
  }

  async getMyDietPlan(userId?: string) {
    if (!userId) throw new UnauthorizedError('Unauthorized');
    const profile = await this.repo.findProfileIdByUserId(userId);
    if (!profile) throw new NotFoundError('Member not found');
    return this.repo.findActiveDietPlan(profile.id);
  }

  async getMyWorkoutRoutine(userId?: string) {
    if (!userId) throw new UnauthorizedError('Unauthorized');
    const profile = await this.repo.findProfileIdByUserId(userId);
    if (!profile) throw new NotFoundError('Member not found');
    return this.repo.findActiveWorkoutRoutine(profile.id);
  }

  async assignDietPlan(
    targetUserId: string,
    input: { title?: string; notes?: string; mealsData: Record<string, string> | string },
    assignedBy?: string,
    tenant?: TenantScope
  ) {
    const profile = await this.repo.findProfileIdByUserId(targetUserId);
    if (!profile) throw new NotFoundError('Member profile not found');
    assertBranchOwnership(profile.branchId, tenant);

    const serializedMeals =
      typeof input.mealsData === 'string' ? input.mealsData : JSON.stringify(input.mealsData);

    return this.repo.replaceActiveDietPlan({
      memberProfileId: profile.id,
      title: input.title || 'Personalized Diet Plan',
      notes: input.notes,
      mealsData: serializedMeals,
      assignedBy,
    });
  }

  async getDietPlanForMember(
    targetUserId: string,
    requester?: { id: string; role: string },
    tenant?: TenantScope
  ) {
    if (requester?.role === 'MEMBER' && requester.id !== targetUserId) {
      throw new ForbiddenError('Forbidden: You can only view your own diet plan');
    }

    const profile = await this.repo.findProfileIdByUserId(targetUserId);
    if (!profile) throw new NotFoundError('Member profile not found');
    assertBranchOwnership(profile.branchId, tenant);
    return this.repo.findActiveDietPlan(profile.id);
  }

  async assignWorkoutRoutine(
    targetUserId: string,
    input: { title?: string; notes?: string; exercisesData: Record<string, string> | string },
    assignedBy?: string,
    tenant?: TenantScope
  ) {
    const profile = await this.repo.findProfileIdByUserId(targetUserId);
    if (!profile) throw new NotFoundError('Member profile not found');
    assertBranchOwnership(profile.branchId, tenant);

    const serializedExercises =
      typeof input.exercisesData === 'string'
        ? input.exercisesData
        : JSON.stringify(input.exercisesData);

    return this.repo.replaceActiveWorkoutRoutine({
      memberProfileId: profile.id,
      title: input.title || 'Personalized Workout Routine',
      notes: input.notes,
      exercisesData: serializedExercises,
      assignedBy,
    });
  }

  async getWorkoutRoutineForMember(
    targetUserId: string,
    requester?: { id: string; role: string },
    tenant?: TenantScope
  ) {
    if (requester?.role === 'MEMBER' && requester.id !== targetUserId) {
      throw new ForbiddenError('Forbidden: You can only view your own workout routine');
    }

    const profile = await this.repo.findProfileIdByUserId(targetUserId);
    if (!profile) throw new NotFoundError('Member profile not found');
    assertBranchOwnership(profile.branchId, tenant);
    return this.repo.findActiveWorkoutRoutine(profile.id);
  }
}

export const portalRoutineService = new PortalRoutineService();
