export default async function handler(req, res) {
  // 仅接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  try {
    const { messages, model, apiEndpoint, apiKey } = req.body;

    // 验证必要参数
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '消息参数无效' });
    }

    if (!apiEndpoint || !apiKey) {
      return res.status(400).json({ error: 'API端点和密钥是必需的' });
    }

    // 准备请求体
    const requestBody = {
      model: model || 'gpt-3.5-turbo',
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: 0.7,
    };

    // 发送请求到指定的API端点
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    // 解析响应
    const data = await response.json();

    // 检查错误
    if (!response.ok) {
      console.error('API错误:', data);
      return res.status(response.status).json({
        error: `API请求失败: ${data.error?.message || JSON.stringify(data)}`
      });
    }

    // 返回助手的回复
    const assistantMessage = data.choices?.[0]?.message;
    if (!assistantMessage) {
      return res.status(500).json({ error: 'API返回的响应格式无效' });
    }

    return res.status(200).json({
      content: assistantMessage.content,
      role: assistantMessage.role,
    });

  } catch (error) {
    console.error('处理助手请求时出错:', error);
    return res.status(500).json({ error: `服务器错误: ${error.message}` });
  }
} 