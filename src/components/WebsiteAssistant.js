import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const WebsiteAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [settings, setSettings] = useState({
    apiEndpoint: 'https://api.example.com/v1/chat/completions',
    apiKey: '',
    defaultModel: 'gpt-3.5-turbo',
    streamOutput: true,
    // 历史消息管理相关设置
    messageHistoryLimit: 10, // 默认每次请求附带10条历史消息
    messageCompressionThreshold: 2000, // 字符数阈值，超过则压缩
    enableHistorySummary: false, // 是否启用历史摘要功能
    historySummaryPrompt: '请总结前面的对话要点，用于后续对话的上下文参考。请简明扼要，不要超过200字。', // 生成摘要的提示词
    namingModel: 'gpt-3.5-turbo', // 用于自动命名对话的模型，默认使用GPT-3.5 Turbo
    autoNameConversation: true // 是否自动命名对话
  });
  const [currentView, setCurrentView] = useState('chat'); // 'chat', 'settings', 'history'
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [models, setModels] = useState([
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    { id: 'gpt-4', name: 'GPT-4' }
  ]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [historyProcessingStatus, setHistoryProcessingStatus] = useState({
    compressed: false,
    summarized: false,
    limitApplied: false,
    originalCount: 0,
    processedCount: 0
  });
  const [sidebarWidth, setSidebarWidth] = useState(384); // 默认宽度
  const [isResizing, setIsResizing] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState({ id: null, status: '' }); // 删除状态
  const [saveStatus, setSaveStatus] = useState(''); // 保存设置状态
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const sidebarRef = useRef(null);
  const resizeHandleRef = useRef(null);

  // 添加一个状态标记是否正在手动滚动
  const [isManualScrolling, setIsManualScrolling] = useState(false);
  // 添加一个标记，记录视图切换到对话的情况
  const [viewChangedToChat, setViewChangedToChat] = useState(false);

  // 在监听滚动事件中添加检查
  useEffect(() => {
    const container = document.querySelector('.overflow-y-auto');
    
    const handleScroll = () => {
      // 如果正在编辑消息，则禁用自动滚动
      if (editingMessageId !== null) {
        setIsManualScrolling(true);
        return;
      }
      
      // 当用户手动滚动时，暂时禁用自动滚动
      setIsManualScrolling(true);
      
      // 如果用户滚动到接近底部，重新启用自动滚动
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
          setIsManualScrolling(false);
        }
      }
      
      // 用户停止滚动一段时间后，重置状态
      clearTimeout(window.scrollTimeout);
      window.scrollTimeout = setTimeout(() => {
        if (container) {
          const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
          if (isNearBottom) {
            setIsManualScrolling(false);
          }
        }
      }, 1000);
    };
    
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      clearTimeout(window.scrollTimeout);
    };
  }, [editingMessageId]);

  // 禁用编辑时的自动滚动
  useEffect(() => {
    if (editingMessageId !== null) {
      setIsManualScrolling(true);
    }
  }, [editingMessageId]);

  // 添加侧边栏调整宽度功能
  useEffect(() => {
    const handleMouseDown = (e) => {
      e.preventDefault();
      setIsResizing(true);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none'; // 防止文本选择
    };

    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      // 计算新宽度 (鼠标X位置减去侧边栏距离文档左侧的距离)
      let newWidth = document.body.clientWidth - e.clientX;
      
      // 设置宽度限制
      const minWidth = 300; // 最小宽度
      const maxWidth = document.body.clientWidth / 2; // 最大宽度为屏幕宽度的一半
      
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      
      setSidebarWidth(newWidth);
      
      // 调整主内容区域
      if (sidebarRef.current) {
        sidebarRef.current.style.width = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const resizeHandle = resizeHandleRef.current;
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (resizeHandle) {
        resizeHandle.removeEventListener('mousedown', handleMouseDown);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // 加载设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('assistantSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    
    // 加载模型列表
    const savedModels = localStorage.getItem('assistantModels');
    if (savedModels) {
      setModels(JSON.parse(savedModels));
    }
    
    // 加载历史对话
    const savedConversations = localStorage.getItem('assistantConversations');
    if (savedConversations) {
      setConversations(JSON.parse(savedConversations));
    }
    
    // 加载当前对话
    const currentId = localStorage.getItem('currentConversationId');
    if (currentId) {
      setCurrentConversationId(currentId);
      const currentConversation = JSON.parse(savedConversations)?.find(c => c.id === currentId);
      if (currentConversation) {
        setMessages(currentConversation.messages);
        setSelectedModel(currentConversation.model || settings.defaultModel);
      }
    } else {
      setSelectedModel(settings.defaultModel);
    }
  }, []);

  // 保存设置到本地存储
  useEffect(() => {
    localStorage.setItem('assistantSettings', JSON.stringify(settings));
  }, [settings]);
  
  // 保存模型列表到本地存储
  useEffect(() => {
    localStorage.setItem('assistantModels', JSON.stringify(models));
  }, [models]);
  
  // 保存对话到本地存储
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('assistantConversations', JSON.stringify(conversations));
    }
  }, [conversations]);
  
  // 保存当前对话ID
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('currentConversationId', currentConversationId);
    }
  }, [currentConversationId]);

  // 添加键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + L 快捷键切换侧边栏
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 添加一个监视当前视图变化的效果
  useEffect(() => {
    // 当视图切换到聊天视图时
    if (currentView === 'chat') {
      setViewChangedToChat(true);
      // 短暂延迟后滚动到底部
      setTimeout(() => {
        const container = document.querySelector('.overflow-y-auto');
        if (container && messages.length > 0) {
          // 确保滚动到底部，使用滚动高度而不是ref
          container.scrollTop = container.scrollHeight;
          // 也可以使用 messagesEndRef，但确保滚动动作是流畅的
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
        // 延长视图切换状态的保持时间，确保有足够时间完成滚动
        setTimeout(() => {
          setViewChangedToChat(false);
        }, 300);
      }, 150);
    }
  }, [currentView, messages.length]);

  // 自动滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      // 使用 requestAnimationFrame 确保在布局完成后再滚动
      requestAnimationFrame(() => {
        const container = document.querySelector('.overflow-y-auto');
        // 只有在当前没有滚动操作时才执行自动滚动，或者是视图切换到对话时
        if (container && (!isManualScrolling || viewChangedToChat)) {
          // 使用平滑滚动，但确保不会在流式输出时频繁触发
          if (!isStreaming) {
            messagesEndRef.current?.scrollIntoView({ behavior: viewChangedToChat ? 'auto' : 'smooth' });
          } else {
            // 流式输出时直接滚动到底部，不使用动画
            container.scrollTop = container.scrollHeight;
          }
        }
      });
    }
  }, [messages, isStreaming, viewChangedToChat, isManualScrolling]);

  // 在AI回复完成后自动聚焦输入框
  useEffect(() => {
    // 当消息加载完成或者流式输出结束时，自动聚焦到输入框
    if (!isLoading && !isStreaming && messages.length > 0 && currentView === 'chat') {
      // 短暂延迟以确保其他UI更新完成
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isLoading, isStreaming, messages.length, currentView]);

  // 优化切换视图时的聚焦行为
  useEffect(() => {
    // 当视图切换到聊天视图时
    if (currentView === 'chat') {
      setViewChangedToChat(true);
      // 短暂延迟后聚焦输入框和滚动到底部
      setTimeout(() => {
        // 滚动到底部
        const container = document.querySelector('.overflow-y-auto');
        if (container && messages.length > 0) {
          container.scrollTop = container.scrollHeight;
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
        
        // 聚焦输入框
        inputRef.current?.focus();
        
        // 延长视图切换状态的保持时间，确保有足够时间完成滚动
        setTimeout(() => {
          setViewChangedToChat(false);
        }, 300);
      }, 150);
    }
  }, [currentView, messages.length]);

  // 移除重复的聚焦效果，因为已经在上面的useEffect中处理了
  // 打开侧边栏时聚焦输入框
  useEffect(() => {
    if (isOpen && currentView === 'chat') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, currentView]);

  const handleSendMessage = async () => {
    // 如果正在加载非流式响应，或者输入为空，则不允许发送
    if (!input.trim() || (isLoading && !isStreaming)) return;
    
    // 如果正在流式输出中，则不允许发送新消息，只能停止生成
    if (isStreaming) {
      handleAbortRequest();
      return;
    }
    
    // 检查是否有当前对话，如果没有则创建新对话
    if (!currentConversationId) {
      createNewConversation();
    }
    
    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    // 重置输入框高度
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = '38px';
    }
    
    // 发送消息后立即重新聚焦输入框
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    
    setIsLoading(true);
    
    // 创建一个新的 AbortController 实例
    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      // 更新当前对话
      updateConversation([...messages, userMessage], selectedModel);
      
      // 处理历史消息，应用限制和压缩
      const processedMessages = await processMessageHistory(
        [...messages, userMessage],
        settings.messageHistoryLimit,
        settings.messageCompressionThreshold,
        settings.enableHistorySummary,
        settings.historySummaryPrompt
      );
      
      if (settings.streamOutput) {
        // 创建助手消息占位符
        const assistantMessageId = Date.now().toString();
        const assistantMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setIsStreaming(true);
        
        // 使用流式输出
        try {
          const response = await fetch('/api/assistant/chat-stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: processedMessages, // 使用处理过的消息
              model: selectedModel,
              apiEndpoint: settings.apiEndpoint,
              apiKey: settings.apiKey,
            }),
            signal: controller.signal
          });
          
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let done = false;
          let accumulatedContent = '';
          
          // 添加防抖动处理
          let lastUpdateTime = 0;
          const UPDATE_INTERVAL = 50; // 50毫秒内最多更新一次UI
          
          while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;
            
            // 使用防抖动更新，降低重绘频率
            const now = Date.now();
            if (now - lastUpdateTime > UPDATE_INTERVAL) {
              lastUpdateTime = now;
              
              // 使用优化后的函数更新内容
              updateStreamingContent(assistantMessageId, accumulatedContent);
            }
          }
          
          // 确保最后一次更新始终执行
          updateStreamingContent(assistantMessageId, accumulatedContent);
          
          // 更新对话历史
          setMessages(prev => {
            const updated = prev.map(msg => 
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            );
            updateConversation([...messages, userMessage, ...updated.filter(m => m.id === assistantMessageId)], selectedModel);
            return updated;
          });
          
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log('用户取消了请求');
            // 更新消息，指示请求被取消
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + '\n\n[用户已停止生成]' }
                  : msg
              )
            );
          } else {
            throw error; // 重新抛出非取消错误
          }
        }
      } else {
        // 非流式输出，保持原有逻辑
        const response = await axios.post('/api/assistant/chat', {
          messages: processedMessages, // 使用处理过的消息
          model: selectedModel,
          apiEndpoint: settings.apiEndpoint,
          apiKey: settings.apiKey,
        }, { signal: controller.signal });
        
        const assistantMessage = {
          role: 'assistant',
          content: response.data.content,
          timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // 更新当前对话
        updateConversation([...messages, userMessage, assistantMessage], selectedModel);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('用户取消了请求');
      } else {
        console.error('Error sending message:', error);
        
        // 添加错误消息
        const errorMessage = {
          role: 'system',
          content: `发生错误: ${error.message || '未知错误'}`,
          timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, errorMessage]);
        
        // 更新当前对话
        updateConversation([...messages, userMessage, errorMessage], selectedModel);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setAbortController(null);
      
      // 消息处理完毕后自动聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleAbortRequest = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const createNewConversation = () => {
    const newId = `conv-${Date.now()}`;
    const newConversation = {
      id: newId,
      title: `新对话`, // 在自动命名完成前显示为"新对话"
      createdAt: new Date().toISOString(),
      messages: [],
      model: selectedModel || settings.defaultModel,
      isNamed: false, // 标记是否已经命名
      isNaming: false // 标记是否正在命名过程中
    };
    
    setConversations(prev => [newConversation, ...prev]); // 将新对话放在最前面
    setCurrentConversationId(newId);
    setMessages([]);
    
    // 创建新对话后自动聚焦输入框
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    
    return newId;
  };
  
  const updateConversation = (updatedMessages, model = selectedModel) => {
    const conversation = conversations.find(conv => conv.id === currentConversationId);
    
    // 检查是否需要自动命名对话
    if (conversation && 
        settings.autoNameConversation && 
        !conversation.isNamed && 
        countConversationRounds(updatedMessages) >= 3) { // 修改为判断对话轮数
      // 只有在完成至少3轮对话后才自动命名
      generateConversationName(updatedMessages);
    }
    
    setConversations(prev => 
      prev.map(conv => 
        conv.id === currentConversationId 
          ? { ...conv, messages: updatedMessages, model } 
          : conv
      )
    );
  };
  
  // 添加一个计算对话轮数的辅助函数
  const countConversationRounds = (messages) => {
    if (!messages || messages.length === 0) return 0;
    
    let rounds = 0;
    let lastRole = null;
    
    // 按照用户-助手配对来计算轮数
    for (const msg of messages) {
      if (msg.role === 'user' && lastRole === 'assistant') {
        rounds++; // 当用户接着助手发言，完成一轮对话
      }
      lastRole = msg.role;
    }
    
    // 处理对话以用户消息结尾的情况
    if (lastRole === 'user' && rounds === 0 && messages.some(msg => msg.role === 'assistant')) {
      rounds = 1; // 如果只有用户-助手一组对话，算作1轮
    }
    
    // 对于只有用户消息的情况
    if (lastRole === 'user' && !messages.some(msg => msg.role === 'assistant')) {
      rounds = 0; // 只有用户消息，不计算为完整轮次
    }
    
    return rounds;
  };
  
  const switchConversation = (id) => {
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      setCurrentConversationId(id);
      setMessages(conversation.messages);
      setSelectedModel(conversation.model || settings.defaultModel);
      // 切换到聊天视图
      setCurrentView('chat');
      // 标记视图切换，用于触发滚动
      setViewChangedToChat(true);
      // 强制滚动到底部并聚焦输入框
      setTimeout(() => {
        const container = document.querySelector('.overflow-y-auto');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
        // 切换对话后自动聚焦输入框
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleChangeModel = (modelId) => {
    setSelectedModel(modelId);
    // 更新当前对话的模型
    if (currentConversationId) {
      updateConversation(messages, modelId);
    }
  };

  const addNewModel = () => {
    if (newModelId.trim() && newModelName.trim()) {
      const newModel = {
        id: newModelId.trim(),
        name: newModelName.trim()
      };
      
      setModels(prev => [...prev, newModel]);
      setNewModelId('');
      setNewModelName('');
    }
  };

  const removeModel = (id) => {
    // 不允许删除当前正在使用的模型
    if (selectedModel === id || settings.defaultModel === id) {
      alert('无法删除正在使用的模型');
      return;
    }
    
    setModels(prev => prev.filter(model => model.id !== id));
  };

  const deleteConversation = (id) => {
    // 设置删除状态
    setDeleteStatus({ id, status: '删除中...' });
    
    const updatedList = conversations.filter(conv => conv.id !== id);
    
    // 保存更新后的列表
    localStorage.setItem('assistantConversations', JSON.stringify(updatedList));
    setConversations(updatedList);
    
    // 如果删除的是当前对话，创建新对话
    if (currentConversationId === id) {
      createNewConversation();
    }
    
    // 显示删除成功状态
    setDeleteStatus({ id, status: '✓ 已删除' });
    
    // 2秒后清除状态
    setTimeout(() => {
      setDeleteStatus({ id: null, status: '' });
    }, 2000);
  };

  // 处理复制消息内容
  const handleCopyMessage = (content, event) => {
    // 阻止事件冒泡，避免干扰其他按钮
    if (event) {
      event.stopPropagation();
    }
    
    // 获取当前点击的按钮元素
    const button = event?.currentTarget;
    
    navigator.clipboard.writeText(content)
      .then(() => {
        if (button) {
          // 添加"已复制"样式
          button.classList.add('copied');
          const originalText = button.textContent;
          button.textContent = "✓ 已复制";
          
          // 2秒后恢复
          setTimeout(() => {
            button.classList.remove('copied');
            button.textContent = originalText;
          }, 2000);
        }
      })
      .catch((err) => {
        console.error('复制失败:', err);
        alert('复制失败，请手动选择文本复制');
      });
  };

  // 处理编辑消息
  const handleEditMessage = (message) => {
    setEditingMessageId(message.id || message.timestamp);
    setEditedContent(message.content);
  };

  // 提交编辑后的消息
  const submitEditedMessage = async () => {
    if (!editedContent.trim()) return;

    // 记录当前消息的位置信息（与cancelEdit类似）
    const messageElem = document.querySelector(`[data-message-id="${editingMessageId}"]`);
    const scrollContainer = document.querySelector('.overflow-y-auto');
    let scrollPosition = 0;
    let messagePosition = 0;
    
    if (messageElem && scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const messageRect = messageElem.getBoundingClientRect();
      messagePosition = messageRect.top - containerRect.top;
      scrollPosition = scrollContainer.scrollTop;
    }

    // 找到正在编辑的消息在数组中的位置
    const messageIndex = messages.findIndex(
      msg => (msg.id || msg.timestamp) === editingMessageId
    );
    if (messageIndex === -1) return;

    // 检查是否是用户消息
    const isUserMessage = messages[messageIndex].role === 'user';
    
    // 更新消息内容
    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      content: editedContent,
      edited: true, // 添加标记表示消息已被编辑
      editedAt: new Date().toISOString()
    };
    
    // 更新消息内容，但不删除后续消息
    setMessages(updatedMessages);
    setEditingMessageId(null);
    setEditedContent('');
    
    // 更新对话历史，但不触发重新生成
    updateConversation(updatedMessages, selectedModel);
    
    // 恢复滚动位置
    setTimeout(() => {
      if (messageElem && scrollContainer) {
        const updatedMessageRect = messageElem.getBoundingClientRect();
        const updatedContainerRect = scrollContainer.getBoundingClientRect();
        const newMessagePosition = updatedMessageRect.top - updatedContainerRect.top;
        scrollContainer.scrollTop = scrollPosition + (newMessagePosition - messagePosition);
      }
      
      // 聚焦输入框
      inputRef.current?.focus();
    }, 50);
  };

  // 重新生成助手回复
  const regenerateResponse = async (messageIndex) => {
    // 保存当前滚动位置
    const chatContainer = document.querySelector('.overflow-y-auto');
    const scrollPosition = chatContainer ? chatContainer.scrollTop : 0;
    
    // 设置手动滚动标记，防止自动滚动干扰
    setIsManualScrolling(true);
    
    // 找到要回复的用户消息
    const messagesToKeep = messages.slice(0, messageIndex + 1);
    
    setMessages(messagesToKeep);
    setIsLoading(true);
    
    // 创建一个新的 AbortController 实例
    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      // 更新对话
      updateConversation(messagesToKeep, selectedModel);
      
      // 处理历史消息，应用限制和压缩
      const processedMessages = await processMessageHistory(
        messagesToKeep,
        settings.messageHistoryLimit,
        settings.messageCompressionThreshold,
        settings.enableHistorySummary,
        settings.historySummaryPrompt
      );
      
      if (settings.streamOutput) {
        // 创建助手消息占位符
        const assistantMessageId = Date.now().toString();
        const assistantMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // 恢复滚动位置，使用更可靠的方式
        setTimeout(() => {
          if (chatContainer) {
            chatContainer.scrollTop = scrollPosition;
            
            // 短暂延迟后再重置手动滚动标记
            setTimeout(() => {
              setIsManualScrolling(false);
            }, 300);
          }
        }, 50);
        
        setIsStreaming(true);
        
        // 使用流式输出
        try {
          const response = await fetch('/api/assistant/chat-stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: processedMessages, // 使用处理过的消息
              model: selectedModel,
              apiEndpoint: settings.apiEndpoint,
              apiKey: settings.apiKey,
            }),
            signal: controller.signal
          });
          
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let done = false;
          let accumulatedContent = '';
          
          while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;
            
            // 更新消息内容
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
          }
          
          // 更新对话历史
          setMessages(prev => {
            const updated = prev.map(msg => 
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            );
            updateConversation([...messagesToKeep, ...updated.filter(m => m.id === assistantMessageId)], selectedModel);
            return updated;
          });
          
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log('用户取消了请求');
            // 更新消息，指示请求被取消
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + '\n\n[用户已停止生成]' }
                  : msg
              )
            );
          } else {
            throw error; // 重新抛出非取消错误
          }
        }
      } else {
        // 非流式输出
        const response = await axios.post('/api/assistant/chat', {
          messages: processedMessages, // 使用处理过的消息
          model: selectedModel,
          apiEndpoint: settings.apiEndpoint,
          apiKey: settings.apiKey,
        }, { signal: controller.signal });
        
        const assistantMessage = {
          role: 'assistant',
          content: response.data.content,
          timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // 更新当前对话
        updateConversation([...messagesToKeep, assistantMessage], selectedModel);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('用户取消了请求');
      } else {
        console.error('重新生成回复时出错:', error);
        
        // 添加错误消息
        const errorMessage = {
          role: 'system',
          content: `发生错误: ${error.message || '未知错误'}`,
          timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, errorMessage]);
        
        // 更新当前对话
        updateConversation([...messagesToKeep, errorMessage], selectedModel);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setAbortController(null);
      
      // 重新生成回复完成后聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // 取消消息编辑
  const cancelEdit = () => {
    // 记录当前消息的位置信息
    const messageElem = document.querySelector(`[data-message-id="${editingMessageId}"]`);
    const scrollContainer = document.querySelector('.overflow-y-auto');
    let scrollPosition = 0;
    let messagePosition = 0;
    
    if (messageElem && scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const messageRect = messageElem.getBoundingClientRect();
      // 计算消息相对于滚动容器的位置
      messagePosition = messageRect.top - containerRect.top;
      // 保存当前滚动位置
      scrollPosition = scrollContainer.scrollTop;
    }
    
    setEditingMessageId(null);
    setEditedContent('');
    
    // 在DOM更新后恢复滚动位置
    setTimeout(() => {
      if (messageElem && scrollContainer) {
        const updatedMessageRect = messageElem.getBoundingClientRect();
        const updatedContainerRect = scrollContainer.getBoundingClientRect();
        const newMessagePosition = updatedMessageRect.top - updatedContainerRect.top;
        // 调整滚动位置，确保消息在相同的位置
        scrollContainer.scrollTop = scrollPosition + (newMessagePosition - messagePosition);
      }
      
      // 取消编辑后聚焦输入框
      inputRef.current?.focus();
    }, 50);
  };

  // 处理块级公式，将 \[ \] 转换为 $$ $$
  const processBlockMath = (content) => {
    if (!content) return '';
    
    // 处理 LaTeX 块级公式 \[ \] 格式，转换为 $$ $$ 格式
    let processed = content.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$');
    
    // 处理行内的 \( \) 语法，转换为 $ $ 格式
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$');
    
    // 处理已经是 $$ $$ 格式的情况，确保它们被正确解析
    // 先检查它们是否已经被正确识别，如果没有则手动处理
    // 这通常用于处理非标准标记，或确保标记直接被显示为块级公式
    if (processed.match(/\$\$([\s\S]*?)\$\$/g)) {
      // 这种情况下已经是 $$ $$ 格式，无需处理
      // 但我们可以确保它被识别为块级公式，比如加入额外空格等
      processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
        // 确保公式前后有换行
        if (!match.startsWith('\n') && !/\n\s*$/.test(match)) {
          return '\n' + match + '\n';
        }
        return match;
      });
    }
    
    // 确保单行内的 $ 不会被错误解析为多个行内公式
    // 例如 $a$ 和 $b$ 应该是两个独立的公式，而非 $a$ 和 $b$ 之间的所有内容
    processed = processed.replace(/(\$)([^\$]+?)(\$)/g, '$1$2$3');
    
    return processed;
  };
  
  // 优化流式输出内容处理
  const updateStreamingContent = (messageId, content) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId
          ? { ...msg, content }
          : msg
      )
    );
  };

  // 添加历史消息处理功能
  const compressMessage = (content, threshold) => {
    if (!content || content.length <= threshold) {
      return content;
    }
    
    // 保留开头和结尾的内容，中间部分截断
    const keepStart = Math.floor(threshold * 0.6); // 保留前60%
    const keepEnd = Math.floor(threshold * 0.4); // 保留后40%
    
    return content.substring(0, keepStart) + 
           `\n\n<div class="compressed-indicator">此消息已压缩，省略了${content.length - threshold}个字符</div>\n\n` + 
           content.substring(content.length - keepEnd);
  };

  // 处理消息历史，限制数量、压缩长消息
  const processMessageHistory = async (messages, limit, compressionThreshold, enableSummary = false, summaryPrompt = '') => {
    if (!messages || messages.length === 0) {
      setHistoryProcessingStatus({
        compressed: false,
        summarized: false,
        limitApplied: false,
        originalCount: 0,
        processedCount: 0
      });
      return [];
    }
    
    // 重置状态
    let processingStatus = {
      compressed: false,
      summarized: false,
      limitApplied: false,
      originalCount: messages.length,
      processedCount: 0
    };
    
    // 第一步：处理历史摘要（如果启用）
    let processedMessages = [...messages];
    let historySummary = null;
    
    if (enableSummary && messages.length > limit + 2) { // 只有当消息数量足够多时才生成摘要
      try {
        // 取前N条消息来生成摘要
        const messagesToSummarize = messages.slice(0, messages.length - limit);
        
        // 创建摘要请求
        historySummary = await generateHistorySummary(messagesToSummarize, summaryPrompt);
        
        if (historySummary) {
          // 如果成功生成摘要，则使用摘要替代早期历史
          processedMessages = [
            { 
              role: 'system', 
              content: `以下是之前对话的摘要：\n${historySummary}\n\n请基于此摘要继续对话。`,
              timestamp: new Date().toISOString()
            },
            ...messages.slice(messages.length - limit)
          ];
          processingStatus.summarized = true;
        }
      } catch (error) {
        console.error('生成历史摘要时出错:', error);
        // 如果摘要生成失败，继续使用限制消息数的方法
      }
    }
    
    // 第二步：如果没有启用摘要或摘要生成失败，则直接限制消息数量
    if (!historySummary && messages.length > limit) {
      processedMessages = messages.slice(Math.max(0, messages.length - limit));
      processingStatus.limitApplied = true;
    }
    
    // 第三步：压缩过长的消息
    let hasCompressed = false;
    processedMessages = processedMessages.map(msg => {
      if (msg.content.length > compressionThreshold) {
        hasCompressed = true;
        return {
          ...msg,
          content: compressMessage(msg.content, compressionThreshold)
        };
      }
      return msg;
    });
    
    processingStatus.compressed = hasCompressed;
    processingStatus.processedCount = processedMessages.length;
    
    // 更新状态
    setHistoryProcessingStatus(processingStatus);
    
    return processedMessages;
  };

  // 生成历史消息摘要
  const generateHistorySummary = async (messages, summaryPrompt) => {
    try {
      // 准备摘要请求
      const summaryMessages = [
        {
          role: 'system',
          content: '你是一个擅长总结对话的助手，你的任务是将对话历史进行简洁的总结，保留关键信息，以便后续模型能够理解对话的上下文。'
        },
        ...messages,
        {
          role: 'user',
          content: summaryPrompt || '请总结前面的对话要点，用于后续对话的上下文参考。请简明扼要，不要超过200字。'
        }
      ];
      
      const response = await axios.post('/api/assistant/chat', {
        messages: summaryMessages,
        model: settings.defaultModel,
        apiEndpoint: settings.apiEndpoint,
        apiKey: settings.apiKey,
      });
      
      return response.data.content;
    } catch (error) {
      console.error('生成摘要时出错:', error);
      return null;
    }
  };

  // 生成对话名称的函数
  const generateConversationName = async (messages) => {
    if (!settings.apiKey || messages.length < 2) return;
    
    try {
      // 准备用于生成名称的消息 - 使用更多的消息内容
      const maxMessagesToUse = Math.min(messages.length, 6); // 使用最多6条消息
      const relevantMessages = messages.slice(0, maxMessagesToUse); // 使用前几条消息
      
      // 添加状态指示
      const conversation = conversations.find(conv => conv.id === currentConversationId);
      if (conversation) {
        setConversations(prev => 
          prev.map(conv => 
            conv.id === currentConversationId 
              ? { ...conv, title: '命名中...', isNaming: true } 
              : conv
          )
        );
      }
      
      const namingMessages = [
        {
          role: 'system',
          content: '你是一个对话命名助手，根据对话内容生成一个简短而准确的标题（不超过15个字），准确反映对话的核心主题。不要使用引号，直接返回标题即可。'
        },
        ...relevantMessages,
        {
          role: 'user',
          content: '请为这个对话生成一个简短的标题，不超过15个字，能准确概括我们讨论的核心主题。直接返回标题文本，不要添加任何其他内容。'
        }
      ];
      
      // 使用命名模型生成标题，确保使用设置中指定的命名模型
      const response = await axios.post('/api/assistant/chat', {
        messages: namingMessages,
        model: settings.namingModel || 'gpt-3.5-turbo', // 默认使用GPT-3.5 Turbo
        apiEndpoint: settings.apiEndpoint,
        apiKey: settings.apiKey,
      });
      
      if (response.data && response.data.content) {
        // 清理生成的标题（去除可能的引号和多余空格）
        let title = response.data.content.trim();
        title = title.replace(/^["'"「『]|["'"」』]$/g, ''); // 移除可能的引号
        
        // 更新对话标题
        setConversations(prev => 
          prev.map(conv => 
            conv.id === currentConversationId 
              ? { ...conv, title, isNamed: true, isNaming: false } 
              : conv
          )
        );
      }
    } catch (error) {
      console.error('生成对话标题时出错:', error);
      // 出错时恢复默认标题
      const conversation = conversations.find(conv => conv.id === currentConversationId);
      if (conversation && conversation.isNaming) {
        setConversations(prev => 
          prev.map(conv => 
            conv.id === currentConversationId 
              ? { ...conv, title: '新对话', isNaming: false } 
              : conv
          )
        );
      }
    }
  };

  // 消息组件
  const MessageItem = ({ message, index }) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const isEditing = (message.id || message.timestamp) === editingMessageId;
    const messageId = message.id || message.timestamp;
    const [showPreview, setShowPreview] = useState(false);
    const [hasRendered, setHasRendered] = useState(false);
    const messageRef = useRef(null);
    
    // 检测消息是否包含压缩标记
    const isCompressed = message.content.includes('<div class="compressed-indicator">');
    
    // 在组件挂载后标记为已渲染，减少布局变化
    useEffect(() => {
      setHasRendered(true);
    }, []);
    
    // 所有非系统消息都可以编辑
    const canEdit = !isSystem;
    // 定义重新生成按钮是否可用 - 对于助手消息，仅当是最后一条助手消息时可重新生成
    const canRegenerate = !isUser && !isSystem && index === messages.length - 1;
    // 判断是否是最后一条用户消息
    const isLastUserMessage = isUser && messages.findIndex(msg => msg.role === 'user' && msg !== message) < index;
    
    // 预处理消息内容，为渲染做准备
    const processedContent = useMemo(() => {
      return processBlockMath(message.content);
    }, [message.content]);
    
    // 保持编辑器光标位置
    const [cursorPosition, setCursorPosition] = useState(null);
    const textareaRef = useRef(null);
    
    // 在光标位置改变后恢复
    useEffect(() => {
      if (isEditing && textareaRef.current && cursorPosition !== null) {
        textareaRef.current.selectionStart = cursorPosition;
        textareaRef.current.selectionEnd = cursorPosition;
      }
    }, [isEditing, editedContent, cursorPosition]);
    
    return (
      <div 
        ref={messageRef}
        data-message-id={messageId}
        className={`relative p-3 rounded-lg max-w-[95%] group ${
          isUser
            ? 'ml-auto bg-blue-500 text-white'
            : isSystem
            ? 'mx-auto bg-yellow-100 text-yellow-800'
            : 'bg-white text-gray-800 shadow'
        } ${isCompressed ? 'border-l-4 border-orange-400' : ''}`}
        style={{
          // 使用固定高度策略减少布局变化
          minHeight: hasRendered ? undefined : isUser ? '50px' : '70px',
          // 确保编辑模式下高度不会随内容变化
          height: isEditing ? messageRef.current?.offsetHeight : 'auto',
          // 使用transform将消息固定到硬件层，减少重绘
          transform: 'translateZ(0)',
          // 防止内容溢出
          overflowWrap: 'break-word',
          wordBreak: 'break-word'
        }}
      >
        {isEditing ? (
          <div className="flex flex-col space-y-2">
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => {
                const textarea = e.target;
                // 保存当前光标位置
                setCursorPosition(textarea.selectionStart);
                setEditedContent(e.target.value);
              }}
              className="w-full p-2 text-gray-800 bg-white border rounded min-h-[100px]"
              autoFocus
            />
            
            {/* 添加公式预览按钮和预览区域 */}
            <div className="flex items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPreview(!showPreview);
                }}
                className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
              >
                {showPreview ? "隐藏预览" : "预览公式"}
              </button>
              {editedContent.includes('\\[') || editedContent.includes('\\(') || editedContent.includes('$') ? (
                <span className="text-xs text-gray-500 ml-2">包含数学公式</span>
              ) : null}
            </div>
            
            {/* 预览区域 */}
            {showPreview && (
              <div className="bg-white border rounded p-3 mt-2">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false }]]}
                  className="text-gray-800"
                >
                  {processBlockMath(editedContent)}
                </ReactMarkdown>
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={cancelEdit}
                className="px-2 py-1 text-xs text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
              >
                取消
              </button>
              <button
                onClick={submitEditedMessage}
                className="px-2 py-1 text-xs text-white bg-blue-500 rounded hover:bg-blue-600"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 在每条消息的右上角添加删除按钮 */}
            {!isSystem && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteMessage(messageId, index);
                }}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded-full w-5 h-5 flex items-center justify-center"
                title="删除此消息"
              >
                ×
              </button>
            )}
            
            <div className="prose prose-sm max-w-none dark:prose-invert stable-content">
              {isUser ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false }]]}
                  className="text-white"
                >
                  {processedContent}
                </ReactMarkdown>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false }]]}
                  className={isSystem ? 'text-yellow-800' : 'text-gray-800'}
                >
                  {processedContent}
                </ReactMarkdown>
              )}
            </div>
            
            {/* 压缩指示器 */}
            {isCompressed && (
              <div className="mt-1 text-xs bg-orange-100 text-orange-700 p-1 rounded">
                <span role="img" aria-label="压缩">📃</span> 此消息已被压缩以减少token用量
              </div>
            )}
            
            {/* 显示编辑标记 */}
            {message.edited && (
              <div className="text-xs text-gray-500 mt-1">
                (已编辑于 {new Date(message.editedAt).toLocaleTimeString()})
              </div>
            )}
            
            {/* 消息操作按钮区域 */}
            <div className="flex justify-between items-center mt-1 button-container">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap space-x-1">
                {/* 复制按钮 - 所有消息都有 */}
                <button
                  onClick={(e) => handleCopyMessage(message.content, e)}
                  className="msg-btn"
                  title="复制"
                >
                  复制
                </button>
                
                {/* 编辑按钮 - 非系统消息都有 */}
                {canEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditMessage(message);
                    }}
                    className="msg-btn"
                    title="编辑"
                  >
                    编辑
                  </button>
                )}
                
                {/* 重新生成按钮 - 只有最后一条助手消息有 */}
                {canRegenerate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      regenerateResponse(index - 1);
                    }}
                    className="msg-btn"
                    title="重新生成"
                    disabled={isLoading}
                  >
                    重新生成
                  </button>
                )}
                
                {/* 用户消息的"重新生成"按钮 */}
                {isUser && index > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      regenerateResponse(index);
                    }}
                    className="msg-btn"
                    title="重新生成回复"
                    disabled={isLoading}
                  >
                    重新生成
                  </button>
                )}
              </div>
              
              <div className="text-xs opacity-70 text-right">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // 保存设置
  const saveSettings = () => {
    localStorage.setItem('assistantSettings', JSON.stringify(settings));
    setSaveStatus('✓ 已保存');
    
    // 2秒后清除状态
    setTimeout(() => {
      setSaveStatus('');
    }, 2000);
  };

  // 渲染设置视图
  const renderSettings = () => (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 shadow-sm bg-gray-100 py-3 px-4 font-medium flex justify-between items-center">
        <h2 className="text-lg">设置</h2>
        <div className="flex items-center">
          {saveStatus && (
            <span className="text-green-600 mr-2 text-sm animate-fade-in">
              {saveStatus}
            </span>
          )}
          <button
            onClick={saveSettings}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            保存设置
          </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-4">
        {/* 设置项 */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API 端点
            </label>
            <input
              type="text"
              value={settings.apiEndpoint}
              onChange={(e) => setSettings(prev => ({ ...prev, apiEndpoint: e.target.value }))}
              placeholder="https://api.example.com/v1/chat/completions"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API 密钥
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey}
                onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="您的 API 密钥"
                className="w-full px-3 py-2 border rounded text-sm pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 hover:text-gray-800"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              默认模型
            </label>
            <select
              value={selectedModel || settings.defaultModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            >
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* 模型管理部分 - 直接跟在默认模型后面 */}
          <div className="pt-2">
            <h4 className="font-medium text-gray-700 mb-2">模型管理</h4>
            
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto border rounded p-2">
              {models.map(model => (
                <div key={model.id} className="flex justify-between items-center p-2 bg-gray-100 rounded">
                  <div>
                    <span className="font-medium">{model.name}</span>
                    <span className="text-sm text-gray-500 ml-2">({model.id})</span>
                  </div>
                  <button
                    onClick={() => removeModel(model.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                    title="删除此模型"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
            
            <div className="bg-gray-100 p-3 rounded">
              <h5 className="font-medium text-sm mb-2">添加新模型</h5>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="模型名称 (比如: GPT-4)"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
                <input
                  type="text"
                  value={newModelId}
                  onChange={(e) => setNewModelId(e.target.value)}
                  placeholder="模型ID (比如: gpt-4)"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
                <button
                  onClick={addNewModel}
                  disabled={!newModelId.trim() || !newModelName.trim()}
                  className={`w-full py-2 rounded text-sm ${
                    !newModelId.trim() || !newModelName.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  添加模型
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center pt-2 border-t">
            <input
              type="checkbox"
              id="streamOutput"
              checked={settings.streamOutput}
              onChange={(e) => setSettings(prev => ({ ...prev, streamOutput: e.target.checked }))}
              className="mr-2"
            />
            <label htmlFor="streamOutput" className="text-sm font-medium text-gray-700">
              使用流式输出（逐字显示响应）
            </label>
          </div>
          
          {/* 对话命名设置 */}
          <div className="pt-4 border-t">
            <h4 className="font-medium text-gray-700 mb-2">对话命名设置</h4>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoNameConversation"
                  checked={settings.autoNameConversation}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    autoNameConversation: e.target.checked 
                  }))}
                  className="mr-2"
                />
                <label htmlFor="autoNameConversation" className="text-sm font-medium text-gray-700">
                  自动为新对话命名
                </label>
              </div>
              
              {settings.autoNameConversation && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    命名使用的模型
                  </label>
                  <select
                    value={settings.namingModel}
                    onChange={(e) => setSettings(prev => ({ ...prev, namingModel: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    {models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    推荐使用 GPT-3.5 Turbo，因为命名功能只需要基础理解能力，使用更快速的模型可以提高体验。
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* 历史消息管理设置区域 */}
          <div className="pt-4 border-t">
            <h4 className="font-medium text-gray-700 mb-2">历史消息管理</h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  每次请求附带历史消息数
                </label>
                <input
                  type="number"
                  value={settings.messageHistoryLimit}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    messageHistoryLimit: Math.max(1, parseInt(e.target.value) || 1) 
                  }))}
                  min="1"
                  max="50"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  值越小消耗的token越少，但可能缺失上下文信息。建议值：5-15
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  历史消息压缩阈值（字符数）
                </label>
                <input
                  type="number"
                  value={settings.messageCompressionThreshold}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    messageCompressionThreshold: Math.max(500, parseInt(e.target.value) || 500) 
                  }))}
                  min="500"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  当单条消息超过该字符数时会被压缩。建议值：1000-3000
                </p>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enableHistorySummary"
                  checked={settings.enableHistorySummary}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    enableHistorySummary: e.target.checked 
                  }))}
                  className="mr-2"
                />
                <label htmlFor="enableHistorySummary" className="text-sm font-medium text-gray-700">
                  启用历史对话摘要
                </label>
              </div>
              
              {settings.enableHistorySummary && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    历史摘要提示词
                  </label>
                  <textarea
                    value={settings.historySummaryPrompt}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      historySummaryPrompt: e.target.value 
                    }))}
                    rows="3"
                    className="w-full px-3 py-2 border rounded text-sm"
                    placeholder="请总结前面的对话要点..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    用于指导模型如何总结历史对话内容
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染历史记录视图（按最新顺序显示）
  const renderHistory = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 shadow-sm bg-gray-100 py-3 px-4 font-medium flex justify-between items-center">
          <h2 className="text-lg">历史对话</h2>
          <button
            onClick={createNewConversation}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            新建对话
          </button>
        </div>
        <div className="flex-grow overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="text-gray-500 text-center p-4">无历史对话</div>
          ) : (
            <ul className="space-y-2">
              {conversations.sort((a, b) => b.createdAt - a.createdAt).map((conversation) => (
                <li key={conversation.id} className="relative">
                  <div 
                    className={`p-3 ${
                      currentConversationId === conversation.id
                        ? 'bg-blue-100 border-blue-300'
                        : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                    } rounded border cursor-pointer flex justify-between items-center group`}
                    onClick={() => switchConversation(conversation.id)}
                  >
                    <div className="flex-grow truncate mr-2">
                      <div className="font-medium truncate">{conversation.title || "新对话"}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(conversation.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {deleteStatus.id === conversation.id ? (
                      <span className="text-green-600 text-sm animate-fade-in">
                        {deleteStatus.status}
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conversation.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 ml-1 text-red-600 hover:text-red-800 transition-opacity"
                        title="删除对话"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  // 渲染聊天视图
  const renderChat = () => (
    <>
      {/* 对话信息栏 */}
      <div className="sticky top-0 z-10 shadow-sm bg-gray-100 py-3 px-4 font-medium flex justify-between items-center">
        <h2 className="text-lg flex items-center">
          {currentConversationId 
            ? conversations.find(c => c.id === currentConversationId)?.title || '新对话'
            : '新对话'}
          {currentConversationId && 
           conversations.find(c => c.id === currentConversationId) && (
             conversations.find(c => c.id === currentConversationId).isNaming ? (
               <span className="ml-2 text-xs text-blue-500 flex items-center">
                 <span className="inline-block animate-pulse mr-1">⋯</span>命名中
               </span>
             ) : !conversations.find(c => c.id === currentConversationId).isNamed && 
                settings.autoNameConversation ? (
               <span className="ml-2 text-xs text-gray-500">
                 (将在3轮对话后自动命名)
               </span>
             ) : null
           )}
        </h2>
        <div className="flex items-center space-x-2">
          <select
            value={selectedModel}
            onChange={(e) => handleChangeModel(e.target.value)}
            className="px-2 py-1 text-sm border rounded bg-white"
          >
            {models.map(model => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
          <button
            onClick={createNewConversation}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            title="开始新对话"
          >
            新建对话
          </button>
        </div>
      </div>
      
      {/* 消息区域 */}
      <div className="flex-grow overflow-y-auto p-4 bg-gray-100 stable-scroll-container">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            发送一条消息开始对话...
          </div>
        ) : (
          <div className="space-y-4 messages-container">
            {/* 历史消息处理状态指示器 */}
            {(historyProcessingStatus.compressed || 
              historyProcessingStatus.summarized || 
              historyProcessingStatus.limitApplied) && (
              <div className="bg-blue-50 text-blue-800 p-2 rounded text-xs text-center">
                <p>使用优化后的上下文 ({historyProcessingStatus.processedCount}/{historyProcessingStatus.originalCount} 条消息)</p>
                <div className="flex justify-center space-x-2 mt-1">
                  {historyProcessingStatus.summarized && (
                    <span className="px-1.5 py-0.5 bg-blue-100 rounded">已生成摘要</span>
                  )}
                  {historyProcessingStatus.compressed && (
                    <span className="px-1.5 py-0.5 bg-blue-100 rounded">已压缩长消息</span>
                  )}
                  {historyProcessingStatus.limitApplied && (
                    <span className="px-1.5 py-0.5 bg-blue-100 rounded">已限制消息数量</span>
                  )}
                </div>
              </div>
            )}
            
            {messages.map((msg, index) => (
              <MessageItem key={msg.id || msg.timestamp || index} message={msg} index={index} />
            ))}
            <div ref={messagesEndRef} className="h-2 w-full" />
          </div>
        )}
      </div>
      
      {/* 可自动扩展高度的输入区域 */}
      <div className="p-3 border-t bg-white">
        <div className="flex">
          <div className="flex-grow relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // 自动调整高度
                e.target.style.height = 'auto';
                const newHeight = Math.min(Math.max(e.target.scrollHeight, 38), 150); // 最小38px，最大150px
                e.target.style.height = `${newHeight}px`;
              }}
              onKeyPress={(e) => {
                // 只有在不是流式输出状态时，回车键才会触发发送消息
                if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="输入您的问题... (Shift+Enter换行)"
              className="w-full px-4 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-auto"
              // 允许在回复生成中输入文字，只有在非流式输出且正在加载时才禁用
              disabled={isLoading && !isStreaming}
              rows="1"
              style={{ minHeight: '38px', maxHeight: '150px' }}
            />
          </div>
          <button
            onClick={isStreaming ? handleAbortRequest : handleSendMessage}
            disabled={(!input.trim() && !isStreaming) || (isLoading && !isStreaming)}
            className={`px-4 py-2 flex items-center justify-center rounded-r-lg self-stretch ${
              (!input.trim() && !isStreaming) || (isLoading && !isStreaming)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isStreaming
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isLoading ? (
              isStreaming ? (
                "停止"
              ) : (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )
            ) : (
              "➤"
            )}
          </button>
        </div>
      </div>
    </>
  );

  // 添加删除消息的处理函数
  const handleDeleteMessage = (messageId, index) => {
    // 记录滚动位置
    const scrollContainer = document.querySelector('.overflow-y-auto');
    const scrollPosition = scrollContainer ? scrollContainer.scrollTop : 0;
    
    // 询问用户确认
    if (confirm('确定要删除这条消息吗？这可能会影响对话的上下文。')) {
      // 删除消息
      const updatedMessages = messages.filter((msg) => 
        (msg.id || msg.timestamp) !== messageId
      );
      
      // 更新对话列表
      setMessages(updatedMessages);
      
      // 更新对话历史
      updateConversation(updatedMessages, selectedModel);
      
      // 恢复滚动位置
      setTimeout(() => {
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollPosition;
        }
      }, 50);
    }
  };

  return (
    <>
      {/* 侧边栏切换按钮 */}
      <button
        className="fixed right-4 top-24 z-50 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 shadow-lg transition-all duration-300"
        onClick={() => setIsOpen(prev => !prev)}
        title={isOpen ? "关闭助手" : "打开助手"}
      >
        {isOpen ? "✕" : "💬"}
      </button>
      
      {/* 侧边栏 */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full bg-white shadow-xl z-40 transition-width duration-100 ease-out flex flex-col ${
          isOpen ? 'visible' : 'invisible w-0 overflow-hidden'
        }`}
        style={{ 
          top: '60px', 
          height: 'calc(100vh - 60px)',
          width: isOpen ? `${sidebarWidth}px` : '0'
        }}
      >
        {/* 宽度调整手柄 */}
        <div 
          ref={resizeHandleRef}
          className="absolute top-0 left-0 w-4 h-full cursor-ew-resize z-50"
          style={{ marginLeft: '-8px' }}
        >
          <div className="h-full w-1 bg-gray-300 opacity-0 hover:opacity-100 mx-auto"></div>
        </div>
        
        {/* 侧边栏导航 */}
        <div className="flex border-b bg-gray-100">
          <button
            onClick={() => setCurrentView('chat')}
            className={`flex-1 py-3 px-4 text-center ${
              currentView === 'chat' 
                ? 'bg-white text-blue-600 border-b-2 border-blue-500'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            💬 对话
          </button>
          <button
            onClick={() => setCurrentView('history')}
            className={`flex-1 py-3 px-4 text-center ${
              currentView === 'history' 
                ? 'bg-white text-blue-600 border-b-2 border-blue-500'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            📋 历史
          </button>
          <button
            onClick={() => setCurrentView('settings')}
            className={`flex-1 py-3 px-4 text-center ${
              currentView === 'settings' 
                ? 'bg-white text-blue-600 border-b-2 border-blue-500'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            ⚙️ 设置
          </button>
        </div>
        
        {/* 侧边栏内容 */}
        <div className="flex-grow flex flex-col overflow-hidden">
          {currentView === 'chat' && renderChat()}
          {currentView === 'settings' && renderSettings()}
          {currentView === 'history' && renderHistory()}
        </div>
      </div>
      
      {/* 主内容区域宽度调整 */}
      <style jsx global>{`
        /* 调整主内容区域样式，随侧边栏宽度变化 */
        body {
          transition: padding-right 100ms ease-out;
          padding-right: ${isOpen ? `${sidebarWidth}px` : '0'};
        }
        
        /* 动画优化 */
        .transition-width {
          transition-property: width;
        }
      `}</style>
    </>
  );
};

export default WebsiteAssistant; 