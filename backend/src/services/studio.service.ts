/* eslint-disable @typescript-eslint/no-explicit-any */
import { AuthStaffRepository, authStaffRepository } from '../repositories/auth-staff.repository';
import { StudioRepository, studioRepository } from '../repositories/studio.repository';
import { MemberRepository, memberRepository } from '../repositories/member.repository';
import { BillingRepository, billingRepository } from '../repositories/billing.repository';
import { CACHE_KEYS, invalidateTenantCacheScopes, memoryCache } from '../utils/cache';
import { AppError, BadRequestError, ForbiddenError, NotFoundError, UpstreamError } from '../utils/errors';
import { logger } from '../utils/logger';
import {
  assertBranchOwnership,
  PRIMARY_BRANCH_ID,
  scopedCacheKey,
  type TenantScope,
} from '../utils/tenant';
import { createMemberRecord, deleteMemberCascade } from './member.service';
import { createSubscriptionWithRepository } from './subscription-ledger.service';

const SETTINGS_CACHE_TTL_SECONDS = 300;

const aiAdminTools = [
  {
    type: 'function',
    function: {
      name: 'add_member',
      description: 'Add a new member to the gym. Provide their details.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address of the member' },
          firstName: { type: 'string', description: 'First name' },
          lastName: { type: 'string', description: 'Last name' },
          password: { type: 'string', description: 'Optional password (defaults to lakzee123)' },
          phone: { type: 'string', description: 'Phone number (optional)' },
          address: { type: 'string', description: 'Address (optional)' },
          gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER'], description: 'Gender (optional)' },
        },
        required: ['email', 'firstName', 'lastName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_member',
      description: 'Update details of an existing member.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address of the member to update' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' },
          address: { type: 'string' },
        },
        required: ['email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_member',
      description: 'Delete a member from the system permanently.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address of the member to delete' },
        },
        required: ['email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assign_plan',
      description: 'Assign a membership plan to a member by their email.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email address of the existing member' },
          planName: { type: 'string', description: "Name or keyword of the plan (e.g. 'Annual', 'Monthly', 'Gold')" },
        },
        required: ['email', 'planName'],
      },
    },
  },
];

const aiVoiceTools = [
  {
    type: 'function',
    function: {
      name: 'navigate_to_page',
      description: "Navigates the user's browser to a specific page.",
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: "The path to navigate to. MUST be one of: '/', '/pricing', '/about', '/contact', '/login'" },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scroll_to_section',
      description: 'Scrolls the page to a specific section on the current page.',
      parameters: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: "The ID of the section to scroll to. E.g., 'trainers', 'hero', 'features'" },
        },
        required: ['sectionId'],
      },
    },
  },
];

export class StudioService {
  constructor(
    private readonly studioRepo: StudioRepository = studioRepository,
    private readonly authStaffRepo: AuthStaffRepository = authStaffRepository,
    private readonly memberRepo: MemberRepository = memberRepository,
    private readonly billingRepo: BillingRepository = billingRepository
  ) {}

  // --- Settings ---
  async getSettings(branchId?: string | null) {
    const cacheKey = scopedCacheKey(CACHE_KEYS.GYM_SETTINGS, branchId);
    const cached = await memoryCache.getDistributed(cacheKey, SETTINGS_CACHE_TTL_SECONDS);
    if (cached) return { settings: cached, cached: true };

    const settings = await this.studioRepo.getOrCreateSettings(branchId);
    memoryCache.set(cacheKey, settings, SETTINGS_CACHE_TTL_SECONDS);
    return { settings, cached: false };
  }

  async updateSettings(validated: Record<string, any>, branchId?: string | null) {
    const resolvedBranchId = branchId || PRIMARY_BRANCH_ID;
    const updated = await this.studioRepo.upsertSettings(validated, resolvedBranchId);
    invalidateTenantCacheScopes(resolvedBranchId, 'settings');
    memoryCache.set(scopedCacheKey(CACHE_KEYS.GYM_SETTINGS, resolvedBranchId), updated, SETTINGS_CACHE_TTL_SECONDS);
    return updated;
  }

  // --- Announcements ---
  listAnnouncements(branchId?: string | null) {
    return this.studioRepo.listAnnouncements(50, branchId);
  }

  createAnnouncement(input: { title: string; message: string; authorId: string; branchId?: string }) {
    return this.studioRepo.createAnnouncement(input);
  }

  async deleteAnnouncement(id: string, tenant?: TenantScope) {
    if (typeof (this.studioRepo as any).findAnnouncementById === 'function') {
      const existing = await this.studioRepo.findAnnouncementById(id);
      if (!existing) throw new NotFoundError('Announcement not found');
      assertBranchOwnership(existing.branchId, tenant);
    }
    await this.studioRepo.deleteAnnouncement(id);
  }

  // --- Staff Management ---
  listStaff(branchId?: string | null) {
    return this.authStaffRepo.listStaffUsers(branchId);
  }

  async assignStaffRole(
    input: { userId: string; role: string; branchId?: string },
    requesterRole?: string,
    tenant?: TenantScope
  ) {
    if (input.role === 'SUPER_ADMIN' && requesterRole !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Only SUPER_ADMIN can assign the SUPER_ADMIN role');
    }

    let targetUserId = input.userId;
    if (targetUserId.startsWith('LZ-')) {
      const profile = await this.authStaffRepo.findUserIdByLakzeeMemberId(
        targetUserId,
        tenant?.branchId
      );
      if (!profile) throw new NotFoundError('Lakzee ID not found');
      targetUserId = profile.userId;
    }

    const user = await this.authStaffRepo.findUserById(targetUserId);
    if (!user) throw new NotFoundError('User UUID not found');
    assertBranchOwnership(user.branchId, tenant);

    if (user.role === 'SUPER_ADMIN' && requesterRole !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Cannot modify a SUPER_ADMIN account');
    }

    const assignedBranchId =
      requesterRole === 'SUPER_ADMIN' && input.branchId ? input.branchId : undefined;
    const updated = await this.authStaffRepo.updateUserRole(
      targetUserId,
      input.role,
      new Date(),
      assignedBranchId
    );
    invalidateTenantCacheScopes(updated.branchId ?? user.branchId, `auth:${targetUserId}`, 'dashboard');
    return updated;
  }

  async revokeStaffRole(
    targetUserId: string,
    requesterUserId?: string,
    requesterRole?: string,
    tenant?: TenantScope
  ) {
    if (requesterUserId === targetUserId) {
      throw new BadRequestError('Cannot revoke your own admin role');
    }

    const target = await this.authStaffRepo.findUserById(targetUserId);
    if (!target) {
      throw new NotFoundError('User not found');
    }
    assertBranchOwnership(target.branchId, tenant);

    if (target.role === 'SUPER_ADMIN' && requesterRole !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Only SUPER_ADMIN can revoke another SUPER_ADMIN role');
    }

    const updated = await this.authStaffRepo.updateUserRole(targetUserId, 'MEMBER');
    invalidateTenantCacheScopes(target.branchId, `auth:${targetUserId}`, 'dashboard');
    return updated;
  }

  // --- Consultation Inquiries ---
  submitConsultationInquiry(input: {
    name: string;
    phone: string;
    email?: string;
    goal: string;
    message?: string;
  }) {
    return this.studioRepo.createConsultationInquiry({
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      goal: input.goal,
      message: input.message || null,
    });
  }

  // --- AI Assistant ---
  isAiConfigured() {
    return !!process.env.OPENROUTER_API_KEY;
  }

  private async executeAiAdminTools(toolCalls: any[], tenant?: TenantScope) {
    const results: any[] = [];
    const branchId = tenant?.branchId ?? PRIMARY_BRANCH_ID;

    for (const call of toolCalls) {
      try {
        const args = JSON.parse(call.function.arguments);

        if (call.function.name === 'add_member') {
          try {
            const newMember = await createMemberRecord(undefined, {
              email: String(args.email),
              firstName: args.firstName,
              lastName: args.lastName,
              password: args.password || 'lakzee123',
              branchId,
              phone: args.phone || undefined,
              address: args.address || undefined,
              gender: args.gender || undefined,
            });
            results.push({
              tool_call_id: call.id,
              role: 'tool',
              name: 'add_member',
              content: `Success: Member ${args.firstName} ${args.lastName} added with ID ${newMember.memberProfile?.memberId}.`,
            });
          } catch (err: any) {
            const content =
              err?.code === 'EMAIL_EXISTS'
                ? 'Error: A member with this email already exists.'
                : `Error executing tool: ${err.message}`;
            results.push({ tool_call_id: call.id, role: 'tool', name: 'add_member', content });
          }
        } else if (call.function.name === 'update_member') {
          const user = await this.memberRepo.findUserByEmail(String(args.email).trim().toLowerCase());
          if (!user || !user.memberProfile) {
            results.push({ tool_call_id: call.id, role: 'tool', name: 'update_member', content: 'Error: Member not found.' });
            continue;
          }
          assertBranchOwnership(user.branchId ?? user.memberProfile.branchId, tenant);

          await this.memberRepo.updateMemberUser(user.id, {
            firstName: args.firstName || user.firstName,
            lastName: args.lastName || user.lastName,
            phone: args.phone || user.phone,
            memberProfile: {
              update: {
                address: args.address || user.memberProfile.address,
              },
            },
          });
          invalidateTenantCacheScopes(user.branchId ?? branchId, 'dashboard', 'reports', 'members');
          results.push({
            tool_call_id: call.id,
            role: 'tool',
            name: 'update_member',
            content: `Success: Details for ${args.email} updated successfully.`,
          });
        } else if (call.function.name === 'delete_member') {
          const user = await this.memberRepo.findUserByEmail(String(args.email).trim().toLowerCase());
          if (!user) {
            results.push({ tool_call_id: call.id, role: 'tool', name: 'delete_member', content: 'Error: Member not found.' });
            continue;
          }
          assertBranchOwnership(user.branchId ?? user.memberProfile?.branchId, tenant);

          await deleteMemberCascade(undefined, user.id);
          results.push({
            tool_call_id: call.id,
            role: 'tool',
            name: 'delete_member',
            content: `Success: Member ${args.email} deleted successfully.`,
          });
        } else if (call.function.name === 'assign_plan') {
          const [user, plans] = await Promise.all([
            this.memberRepo.findUserByEmail(String(args.email).trim().toLowerCase()),
            this.billingRepo.listActivePlanNames(tenant?.branchId),
          ]);

          if (!user || !user.memberProfile) {
            results.push({ tool_call_id: call.id, role: 'tool', name: 'assign_plan', content: 'Error: Member not found.' });
            continue;
          }
          assertBranchOwnership(user.branchId ?? user.memberProfile.branchId, tenant);

          const plan = plans.find((p) => p.name.toLowerCase().includes(String(args.planName).toLowerCase()));
          if (!plan) {
            results.push({
              tool_call_id: call.id,
              role: 'tool',
              name: 'assign_plan',
              content: `Error: Plan matching '${args.planName}' not found. Available plans: ${plans.map((p) => p.name).join(', ')}`,
            });
            continue;
          }

          const { endDate } = await createSubscriptionWithRepository(
            this.billingRepo,
            {
              branchId: user.branchId ?? branchId,
              memberId: user.memberProfile.id,
              planId: plan.id,
              startDate: new Date(),
              paymentStatus: 'PAID',
              paymentMethod: 'CASH',
            },
            tenant
          );

          results.push({
            tool_call_id: call.id,
            role: 'tool',
            name: 'assign_plan',
            content: `Success: Plan '${plan.name}' assigned to ${user.firstName}. Valid until ${endDate.toDateString()}.`,
          });
        }
      } catch (e: any) {
        results.push({
          tool_call_id: call.id,
          role: 'tool',
          name: call.function.name,
          content: `Error executing tool: ${e.message}`,
        });
      }
    }

    return results;
  }

  async chatWithAi(input: { messages: any[]; model?: string }, tenant?: TenantScope) {
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      throw new AppError('AI service is not configured. Please configure OPENROUTER_API_KEY.', 503, 'AI_CONFIG_MISSING');
    }

    const targetModel = input.model || 'google/gemma-4-31b-it:free';
    const systemPrompt = {
      role: 'system',
      content:
        'You are the Lakzee Fitness Studio AI Assistant. You have access to tools to manage the gym. When a user asks you to add, update, or delete a member, or assign a plan, USE the provided tools. Do not just output JSON in chat, literally call the function. Be helpful, concise, and professional.',
    };
    const formattedMessages = [systemPrompt, ...input.messages];

    const callOpenRouter = async (currentMessages: any[]) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        return await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            'HTTP-Referer': 'https://lakzeefitness.com',
            'X-Title': 'Lakzee Fitness Web App',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: targetModel, messages: currentMessages, tools: aiAdminTools }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    let response: Response;
    try {
      response = await callOpenRouter(formattedMessages);
    } catch (fetchError: any) {
      if (fetchError?.name === 'AbortError') {
        throw new UpstreamError('AI request timed out. Please try again.', 504, 'AI_TIMEOUT');
      }
      throw new UpstreamError('Failed to connect to AI provider.', 502, 'AI_NETWORK_ERROR');
    }

    if (!response.ok) {
      const codeMap: Record<number, string> = {
        400: 'AI_BAD_REQUEST',
        401: 'AI_UNAUTHORIZED',
        403: 'AI_FORBIDDEN',
        404: 'AI_MODEL_NOT_FOUND',
        429: 'AI_RATE_LIMITED',
        504: 'AI_TIMEOUT',
      };
      throw new AppError(
        `Upstream error: ${response.statusText}`,
        response.status,
        codeMap[response.status] ?? 'AI_UPSTREAM_ERROR'
      );
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new UpstreamError('AI provider returned an unexpected response (non-JSON).', 502, 'AI_UPSTREAM_NON_JSON');
    }

    const data: any = await response.json();
    const message = data?.choices?.[0]?.message;
    if (!message) {
      throw new UpstreamError('AI provider returned an invalid response structure.', 502, 'AI_INVALID_RESPONSE');
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolResults = await this.executeAiAdminTools(message.tool_calls, tenant);
      const nextMessages = [...formattedMessages, message, ...toolResults];

      try {
        const secondResponse = await callOpenRouter(nextMessages);
        if (secondResponse.ok) {
          const secondData: any = await secondResponse.json();
          if (secondData?.choices?.[0]?.message) {
            return { data: secondData, toolResults };
          }
        }
      } catch (e) {
        logger.warn('AI chat second-pass completion failed', { error: e });
      }

      return {
        data: {
          choices: [
            {
              message: {
                role: 'assistant',
                content: `I executed the actions:\n${toolResults.map((r) => r.content).join('\n')}`,
              },
            },
          ],
        },
        toolResults,
      };
    }

    return { data };
  }

  async voiceAssistant(messages: any[]) {
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      throw new AppError('AI service not configured.', 503, 'AI_CONFIG_MISSING');
    }

    const systemPrompt = {
      role: 'system',
      content: `You are F.R.I.D.A.Y, the highly intelligent and conversational AI voice assistant for Lakzee Fitness Studio.
Your responses should be natural, brief, and sound good when spoken aloud (no markdown, no code blocks).
Help users find information about the gym.
Our coaches are Madhappan D (Founder & Head Strength Coach) and Sakthi vel (Main Coach).
- To see pricing/membership plans: call 'navigate_to_page' with path '/pricing'
- To see trainers: call 'scroll_to_section' with sectionId 'trainers'
- For contact/consultation: call 'navigate_to_page' with path '/contact'
- To go home/back: call 'navigate_to_page' with path '/'
- For admin login: call 'navigate_to_page' with path '/login'`,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let chatResponse: Response;

    try {
      chatResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': 'https://lakzeefitness.com',
          'X-Title': 'Lakzee Voice Assistant',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemma-4-31b-it:free',
          messages: [systemPrompt, ...messages],
          tools: aiVoiceTools,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new UpstreamError('AI chat timeout.', 504);
      }
      throw new UpstreamError('Network error connecting to chat API.', 502);
    } finally {
      clearTimeout(timeout);
    }

    if (!chatResponse.ok) {
      throw new UpstreamError(`Chat API error: ${chatResponse.statusText}`, chatResponse.status);
    }

    const data: any = await chatResponse.json();
    const aiMessage = data?.choices?.[0]?.message;
    if (aiMessage?.content) {
      const ttsController = new AbortController();
      const ttsTimeout = setTimeout(() => ttsController.abort(), 30000);
      try {
        const ttsResponse = await fetch('https://openrouter.ai/api/v1/audio/speech', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            'HTTP-Referer': 'https://lakzeefitness.com',
            'X-Title': 'Lakzee Voice Assistant',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'fish-audio/s2.1-pro-free:free',
            input: aiMessage.content,
            response_format: 'mp3',
          }),
          signal: ttsController.signal,
        });

        if (ttsResponse.ok) {
          const arrayBuffer = await ttsResponse.arrayBuffer();
          aiMessage.audio = {
            data: Buffer.from(arrayBuffer).toString('base64'),
            format: 'mp3',
          };
        }
      } catch (err) {
        logger.warn('AI voice TTS synthesis failed; falling back to browser TTS', { error: err });
      } finally {
        clearTimeout(ttsTimeout);
      }
    }

    return data;
  }
}

export const studioService = new StudioService();
