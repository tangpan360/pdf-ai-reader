export default async function handler(req, res) {
  // 设置响应头，支持流式输出
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  
  // 仅接受 POST 请求
  if (req.method !== 'POST') {
    res.status(405).end('只支持 POST 请求');
    return;
  }

  try {
    const { messages, model, apiEndpoint, apiKey } = req.body;

    // 验证必要参数
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).end('消息参数无效');
      return;
    }

    if (!apiEndpoint || !apiKey) {
      res.status(400).end('API端点和密钥是必需的');
      return;
    }

    // 准备请求体
    const requestBody = {
      model: model || 'gpt-3.5-turbo',
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: 0.7,
      stream: true,
    };

    // 创建一个客户端AbortController以便能够中止底层的fetch请求
    const controller = new AbortController();
    const signal = controller.signal;

    // 如果客户端中止连接，我们也应该中止到LLM的请求
    req.on('close', () => {
      controller.abort();
    });

    try {
      // 发送请求到指定的API端点
      const llmResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: signal,
      });

      if (!llmResponse.ok) {
        // 处理API错误
        const errorData = await llmResponse.json();
        console.error('API错误:', errorData);
        res.status(llmResponse.status).end(`API请求失败: ${errorData.error?.message || JSON.stringify(errorData)}`);
        return;
      }

      // 获取响应流
      const reader = llmResponse.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      // 处理流数据
      try {
        let done = false;
        
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          
          if (done) {
            break;
          }
          
          // 解码获取的块
          const chunk = decoder.decode(value);
          
          // 处理SSE格式的响应
          // 如果是OpenAI的流格式，这里需要解析"data: "前缀的JSON
          // 这里我们简化处理，直接提取内容部分
          try {
            // 分割行
            const lines = chunk.split('\n');
            let textContent = '';
            
            for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const jsonStr = line.substring(6); // 移除 "data: " 前缀
                  
                  // 增加对不完整JSON的健壮性
                  if (!jsonStr.trim()) continue;
                  
                  try {
                    const jsonData = JSON.parse(jsonStr);
                    
                    // 提取内容增量
                    const delta = jsonData.choices[0]?.delta;
                    if (delta && delta.content) {
                      textContent += delta.content;
                    }
                  } catch (parseError) {
                    console.warn('解析JSON时出错，可能是不完整的数据:', parseError.message);
                    // 记录错误但继续处理，不抛出异常
                    // 尝试修复常见的JSON不完整问题
                    try {
                      // 对于未终止的字符串，尝试添加结束引号并解析
                      if (parseError.message.includes('Unterminated string')) {
                        const fixedJson = jsonStr + '"}]}';
                        const jsonData = JSON.parse(fixedJson);
                        const delta = jsonData.choices[0]?.delta;
                        if (delta && delta.content) {
                          textContent += delta.content;
                        }
                      }
                    } catch (e) {
                      // 修复尝试失败，忽略这一部分数据
                      console.error('尝试修复JSON失败:', e.message);
                    }
                  }
                } catch (e) {
                  console.error('处理数据行时出错:', e);
                  // 继续处理下一行
                }
              } else if (line === 'data: [DONE]') {
                // 流结束标记，不需要处理
                continue;
              }
            }
            
            // 将提取的内容发送到客户端
            if (textContent) {
              res.write(textContent);
              
              // 确保数据被立即发送出去，解决内网穿透问题
              if (res.flush) {
                res.flush();
              }
            }
          } catch (e) {
            console.error('处理响应块时出错:', e);
            // 发送原始数据
            res.write(chunk);
          }
        }
        
        res.end();
      } catch (e) {
        // 处理流读取期间的错误
        if (e.name === 'AbortError') {
          // 请求被中止，通常是由于客户端断开连接
          console.log('流式传输已被中止');
          res.end();
        } else {
          throw e; // 重新抛出非中止错误
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // 请求被用户中止
        res.end();
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('处理助手流式请求时出错:', error);
    res.status(500).end(`服务器错误: ${error.message}`);
  }
} 