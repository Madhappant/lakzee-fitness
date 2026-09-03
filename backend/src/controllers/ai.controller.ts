import { Request, Response } from 'express';
import { prisma } from '../app';
import bcrypt from 'bcryptjs';

export const checkAiStatus = async (req: Request, res: Response) => {
  try {
    const hasKey = !!process.env.OPENROUTER_API_KEY;
    return res.json({
      status: 'success',
      configured: hasKey
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', code: 'AI_UNKNOWN_ERROR', message: 'Failed to check AI status' });
  }
};

const tools = [
  {
    type: "function",
    function: {
      name: "add_member",
      description: "Add a new member to the gym. Provide their details.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Email address of the member" },
          firstName: { type: "string", description: "First name" },
          lastName: { type: "string", description: "Last name" },
          password: { type: "string", description: "Optional password (defaults to lakzee123)" },
          phone: { type: "string", description: "Phone number (optional)" },
          address: { type: "string", description: "Address (optional)" },
          gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER"], description: "Gender (optional)" }
        },
        required: ["email", "firstName", "lastName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_member",
      description: "Update details of an existing member.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Email address of the member to update" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" }
        },
        required: ["email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_member",
      description: "Delete a member from the system permanently.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Email address of the member to delete" }
        },
        required: ["email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "assign_plan",
      description: "Assign a membership plan to a member by their email.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Email address of the existing member" },
          planName: { type: "string", description: "Name or keyword of the plan (e.g. 'Annual', 'Monthly', 'Gold')" }
        },
        required: ["email", "planName"]
      }
    }
  }
];

async function handleToolCalls(toolCalls: any[]) {
  const results = [];
  
  for (const call of toolCalls) {
    try {
      const args = JSON.parse(call.function.arguments);
      
      if (call.function.name === "add_member") {
        const existing = await prisma.user.findUnique({ where: { email: args.email } });
        if (existing) {
          results.push({ tool_call_id: call.id, role: "tool", name: "add_member", content: "Error: A member with this email already exists." });
          continue;
        }

        const pwd = args.password || "lakzee123";
        const hashedPassword = await bcrypt.hash(pwd, 10);
        const memberId = 'LZM' + Math.floor(1000 + Math.random() * 9000).toString();
        
        await prisma.user.create({
          data: {
            email: args.email,
            firstName: args.firstName,
            lastName: args.lastName,
            phone: args.phone || null,
            password: hashedPassword,
            role: "MEMBER",
            memberProfile: {
              create: {
                memberId: memberId,
                gender: args.gender || null,
                address: args.address || null
              }
            }
          }
        });
        
        results.push({ tool_call_id: call.id, role: "tool", name: "add_member", content: `Success: Member ${args.firstName} ${args.lastName} added with ID ${memberId} and password ${pwd}.` });
      } 
      
      else if (call.function.name === "update_member") {
        const user = await prisma.user.findUnique({ 
          where: { email: args.email },
          include: { memberProfile: true }
        });
        
        if (!user || !user.memberProfile) {
          results.push({ tool_call_id: call.id, role: "tool", name: "update_member", content: "Error: Member not found." });
          continue;
        }
        
        await prisma.user.update({
          where: { email: args.email },
          data: {
            firstName: args.firstName || user.firstName,
            lastName: args.lastName || user.lastName,
            phone: args.phone || user.phone,
            memberProfile: {
              update: {
                address: args.address || user.memberProfile.address
              }
            }
          }
        });
        
        results.push({ tool_call_id: call.id, role: "tool", name: "update_member", content: `Success: Details for ${args.email} updated successfully.` });
      }

      else if (call.function.name === "delete_member") {
        const user = await prisma.user.findUnique({ where: { email: args.email } });
        
        if (!user) {
          results.push({ tool_call_id: call.id, role: "tool", name: "delete_member", content: "Error: Member not found." });
          continue;
        }
        
        // Prisma cascade deletes will handle memberProfile, subscriptions etc if configured correctly.
        await prisma.user.delete({ where: { email: args.email } });
        
        results.push({ tool_call_id: call.id, role: "tool", name: "delete_member", content: `Success: Member ${args.email} deleted successfully.` });
      }

      else if (call.function.name === "assign_plan") {
        const user = await prisma.user.findUnique({ 
          where: { email: args.email },
          include: { memberProfile: true }
        });
        
        if (!user || !user.memberProfile) {
          results.push({ tool_call_id: call.id, role: "tool", name: "assign_plan", content: "Error: Member not found." });
          continue;
        }
        
        const plans = await prisma.membershipPlan.findMany();
        const plan = plans.find(p => p.name.toLowerCase().includes(args.planName.toLowerCase()));
        
        if (!plan) {
          results.push({ tool_call_id: call.id, role: "tool", name: "assign_plan", content: `Error: Plan matching '${args.planName}' not found. Available plans: ${plans.map(p => p.name).join(", ")}` });
          continue;
        }

        const start = new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + plan.durationDays);

        await prisma.subscription.create({
          data: {
            memberId: user.memberProfile.id,
            planId: plan.id,
            startDate: start,
            endDate: end,
            status: "ACTIVE",
            paymentStatus: "PAID",
            paymentMethod: "CASH",
            balanceAmount: 0
          }
        });
        
        results.push({ tool_call_id: call.id, role: "tool", name: "assign_plan", content: `Success: Plan '${plan.name}' assigned to ${user.firstName}. Valid until ${end.toDateString()}.` });
      }
    } catch (e: any) {
      results.push({ tool_call_id: call.id, role: "tool", name: call.function.name, content: `Error executing tool: ${e.message}` });
    }
  }
  
  return results;
}

export const chatWithAi = async (req: Request, res: Response) => {
  try {
    const { messages, model } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ status: 'error', code: 'AI_BAD_REQUEST', message: 'Invalid messages array' });
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey) {
      return res.status(503).json({ 
        status: 'error', 
        code: 'AI_CONFIG_MISSING',
        message: 'AI service is not configured. Please configure OPENROUTER_API_KEY.' 
      });
    }

    const targetModel = model || 'google/gemma-4-31b-it:free';
    
    // Inject system prompt to guide the AI
    const systemPrompt = {
      role: "system",
      content: "You are the Lakzee Fitness Studio AI Assistant. You have access to tools to manage the gym. When a user asks you to add, update, or delete a member, or assign a plan, USE the provided tools. Do not just output JSON in chat, literally call the function. Be helpful, concise, and professional."
    };
    
    const formattedMessages = [systemPrompt, ...messages];
    
    const makeRequest = async (currentMessages: any[]) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterApiKey}`,
            "HTTP-Referer": "https://lakzeefitness.com",
            "X-Title": "Lakzee Fitness Web App",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: targetModel,
            messages: currentMessages,
            tools: tools
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        return response;
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    };

    let response;
    try {
      response = await makeRequest(formattedMessages);
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        return res.status(504).json({ status: 'error', code: 'AI_TIMEOUT', message: 'AI request timed out. Please try again.' });
      }
      return res.status(502).json({ status: 'error', code: 'AI_NETWORK_ERROR', message: 'Failed to connect to AI provider.' });
    }

    if (!response.ok) {
      let code = 'AI_UPSTREAM_ERROR';
      if (response.status === 400) code = 'AI_BAD_REQUEST';
      if (response.status === 401) code = 'AI_UNAUTHORIZED';
      if (response.status === 403) code = 'AI_FORBIDDEN';
      if (response.status === 404) code = 'AI_MODEL_NOT_FOUND';
      if (response.status === 429) code = 'AI_RATE_LIMITED';
      if (response.status === 500 || response.status === 502 || response.status === 503) code = 'AI_UPSTREAM_ERROR';
      if (response.status === 504) code = 'AI_TIMEOUT';

      return res.status(response.status).json({
        status: 'error',
        code,
        message: `Upstream error: ${response.statusText}`
      });
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return res.status(502).json({
        status: 'error',
        code: 'AI_UPSTREAM_NON_JSON',
        message: 'AI provider returned an unexpected response (non-JSON).'
      });
    }

    let data = await response.json();

    if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.status(502).json({
        status: 'error',
        code: 'AI_INVALID_RESPONSE',
        message: 'AI provider returned an invalid response structure.'
      });
    }

    const message = data.choices[0].message;

    // Check if the AI wants to call tools
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolResults = await handleToolCalls(message.tool_calls);
      
      // Append assistant's tool call message and the results
      const nextMessages = [
        ...formattedMessages,
        message,
        ...toolResults
      ];

      // Call OpenRouter again with the tool results
      try {
        const secondResponse = await makeRequest(nextMessages);
        if (secondResponse.ok) {
          const secondData = await secondResponse.json();
          if (secondData.choices?.[0]?.message) {
            return res.json({ status: 'success', data: secondData, toolResults });
          }
        }
      } catch (e) {
        console.error("Second pass failed", e);
      }
      
      // If second pass fails or doesn't return properly, we can just return a fallback message
      return res.json({ 
        status: 'success', 
        data: { 
          choices: [{ 
            message: { 
              role: 'assistant', 
              content: `I executed the actions:\n${toolResults.map(r => r.content).join('\n')}` 
            } 
          }] 
        } 
      });
    }

    res.json({ status: 'success', data });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ status: 'error', code: 'AI_UNKNOWN_ERROR', message: 'An unexpected error occurred while communicating with the AI.' });
  }
};

const voiceTools = [
  {
    type: "function",
    function: {
      name: "navigate_to_page",
      description: "Navigates the user's browser to a specific page.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The path to navigate to. MUST be one of: '/', '/pricing', '/about', '/contact', '/login'" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "scroll_to_section",
      description: "Scrolls the page to a specific section on the current page.",
      parameters: {
        type: "object",
        properties: {
          sectionId: { type: "string", description: "The ID of the section to scroll to. E.g., 'trainers', 'hero', 'features'" }
        },
        required: ["sectionId"]
      }
    }
  }
];

export const voiceAssistant = async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ status: 'error', code: 'AI_BAD_REQUEST', message: 'Invalid messages array' });
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey) {
      return res.status(503).json({ status: 'error', code: 'AI_CONFIG_MISSING', message: 'AI service not configured.' });
    }

    // We use a fast capable model for the conversational logic and tool calling
    const chatModel = 'google/gemma-4-31b-it:free'; 
    // And fish-audio for TTS
    const ttsModel = 'fish-audio/s2.1-pro-free:free';

    const systemPrompt = {
      role: "system",
      content: `You are F.R.I.D.A.Y, the highly intelligent and conversational AI voice assistant for Lakzee Fitness Studio.
Your responses should be natural, brief, and sound good when spoken aloud (no markdown, no code blocks).
Help users find information about the gym.
- To see pricing/membership plans: call 'navigate_to_page' with path '/pricing'
- To see trainers: call 'scroll_to_section' with sectionId 'trainers'
- For contact/consultation: call 'navigate_to_page' with path '/contact'
- To go home/back: call 'navigate_to_page' with path '/'
- For admin login: call 'navigate_to_page' with path '/login'`
    };
    
    const formattedMessages = [systemPrompt, ...messages];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s for chat
    
    let chatResponse;
    try {
      chatResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "HTTP-Referer": "https://lakzeefitness.com",
          "X-Title": "Lakzee Voice Assistant",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: chatModel,
          messages: formattedMessages,
          tools: voiceTools
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        return res.status(504).json({ status: 'error', message: 'AI chat timeout.' });
      }
      return res.status(502).json({ status: 'error', message: 'Network error connecting to chat API.' });
    }

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error("OpenRouter Chat Error:", chatResponse.status, errorText);
      return res.status(chatResponse.status).json({ status: 'error', message: `Chat API error: ${chatResponse.statusText}` });
    }

    const data = await chatResponse.json();
    
    // Now, if there is a conversational response, we fetch TTS audio
    const aiMessage = data.choices?.[0]?.message;
    if (aiMessage && aiMessage.content) {
      const ttsController = new AbortController();
      const ttsTimeout = setTimeout(() => ttsController.abort(), 30000);
      try {
        const ttsResponse = await fetch("https://openrouter.ai/api/v1/audio/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterApiKey}`,
            "HTTP-Referer": "https://lakzeefitness.com",
            "X-Title": "Lakzee Voice Assistant",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: ttsModel,
            input: aiMessage.content,
            response_format: 'mp3'
          }),
          signal: ttsController.signal
        });
        clearTimeout(ttsTimeout);

        if (ttsResponse.ok) {
          const arrayBuffer = await ttsResponse.arrayBuffer();
          const base64Audio = Buffer.from(arrayBuffer).toString('base64');
          aiMessage.audio = {
            data: base64Audio,
            format: 'mp3'
          };
        } else {
          console.error("OpenRouter TTS Error:", ttsResponse.status, await ttsResponse.text());
          // We don't fail the request, we just fallback to browser TTS in frontend
        }
      } catch (err) {
        clearTimeout(ttsTimeout);
        console.error("TTS fetch failed", err);
        // Fallback to browser TTS in frontend
      }
    }

    return res.json({ status: 'success', data });

  } catch (error: any) {
    console.error('AI Voice Error:', error);
    res.status(500).json({ status: 'error', message: 'An unexpected error occurred.' });
  }
};
