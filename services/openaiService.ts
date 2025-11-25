const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

const apiFetch = async (path: string, body: any) => {
  const res = await fetch(`https://api.openai.com/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};

export const analyzeChartOpenAI = async (imageBase64: string, promptText: string, model: string): Promise<string> => {
  const url = imageBase64;
  const data = await apiFetch('chat/completions', {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url } }
        ]
      }
    ]
  });
  const choice = data.choices?.[0]?.message?.content;
  if (Array.isArray(choice)) {
    const textPart = choice.find((p: any) => p.type === 'text');
    return textPart?.text || 'No analysis generated.';
  }
  return choice || 'No analysis generated.';
};

export const analyzeChartMultiOpenAI = async (images: string[], promptText: string, model: string): Promise<string> => {
  const content = [{ type: 'text', text: promptText }, ...images.map((img) => ({ type: 'image_url', image_url: { url: img } }))];
  const data = await apiFetch('chat/completions', {
    model,
    messages: [
      { role: 'user', content }
    ]
  });
  const choice = data.choices?.[0]?.message?.content;
  if (Array.isArray(choice)) {
    const textPart = choice.find((p: any) => p.type === 'text');
    return textPart?.text || 'No analysis generated.';
  }
  return choice || 'No analysis generated.';
};

export const sendChatMessageOpenAI = async (history: { role: 'user' | 'assistant'; content: { type: 'text'; text: string }[] }[], newMessage: string, model: string): Promise<string> => {
  const messages = [
    ...history,
    { role: 'user', content: [{ type: 'text', text: newMessage }] }
  ].map((m) => ({ role: m.role, content: m.content }));
  const data = await apiFetch('chat/completions', { model, messages });
  const content = data.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    const textPart = content.find((p: any) => p.type === 'text');
    return textPart?.text || 'I could not process that.';
  }
  return content || 'I could not process that.';
};

