import { Request, Response } from 'express';

export const chatWithAi = async (req: Request, res: Response) => {
  try {
    const { messages, model, apiKey } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ status: 'error', message: 'Invalid messages array' });
    }

    const openRouterApiKey = apiKey || process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'OpenRouter API key is missing. Please provide it in the request or set OPENROUTER_API_KEY in the environment.' 
      });
    }

    const targetModel = model || 'google/gemma-4-31b-it:free';

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
        messages: messages,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        status: 'error', 
        message: 'Error from OpenRouter', 
        details: errorData 
      });
    }

    const data = await response.json();
    res.json({ status: 'success', data });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to communicate with AI' });
  }
};
