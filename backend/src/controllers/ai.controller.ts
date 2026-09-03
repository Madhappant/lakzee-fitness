import { Request, Response } from 'express';

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    let response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "HTTP-Referer": "https://lakzeefitness.com",
          "X-Title": "Lakzee Fitness Web App",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: targetModel,
          messages: messages,
        }),
        signal: controller.signal
      });
    } catch (fetchError: any) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return res.status(504).json({ status: 'error', code: 'AI_TIMEOUT', message: 'AI request timed out. Please try again or select another model.' });
      }
      return res.status(502).json({ status: 'error', code: 'AI_NETWORK_ERROR', message: 'Failed to connect to AI provider.' });
    }

    clearTimeout(timeout);

    // Map HTTP status codes
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

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      return res.status(502).json({
        status: 'error',
        code: 'AI_INVALID_RESPONSE',
        message: 'Failed to parse JSON from AI provider.'
      });
    }

    if (!data || !data.choices || !Array.isArray(data.choices) || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      return res.status(502).json({
        status: 'error',
        code: 'AI_INVALID_RESPONSE',
        message: 'AI provider returned an invalid response structure.'
      });
    }

    res.json({ status: 'success', data });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ status: 'error', code: 'AI_UNKNOWN_ERROR', message: 'An unexpected error occurred while communicating with the AI.' });
  }
};
