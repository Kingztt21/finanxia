export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('[API] GROQ_API_KEY not configured');
    return response.status(500).json({
      error: 'API key not configured on server. Please set GROQ_API_KEY environment variable.'
    });
  }

  const { messages } = request.body;
  if (!messages) {
    return response.status(400).json({ error: 'Messages required' });
  }

  try {
    const apiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.9
      })
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
      console.error('[API] Groq API error', data);
      return response.status(apiResponse.status).json(data);
    }

    return response.status(200).json(data);
  } catch (error) {
    console.error('[API] error:', error);
    return response.status(500).json({ error: error.message });
  }
}
