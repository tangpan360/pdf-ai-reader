import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function AssistantHistory() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 从本地存储加载对话历史
    const savedConversations = localStorage.getItem('assistantConversations');
    if (savedConversations) {
      try {
        setConversations(JSON.parse(savedConversations));
      } catch (error) {
        console.error('解析对话历史时出错:', error);
      }
    }
    setLoading(false);
  }, []);

  const deleteConversation = (id) => {
    // 获取存储的对话
    const conversations = JSON.parse(localStorage.getItem('assistantConversations') || '[]');
    
    // 过滤掉要删除的对话
    const updatedConversations = conversations.filter(conv => conv.id !== id);
    
    // 保存更新后的对话列表
    localStorage.setItem('assistantConversations', JSON.stringify(updatedConversations));
    
    // 如果删除的是当前对话，清除当前对话ID
    if (id === localStorage.getItem('currentConversationId')) {
      localStorage.removeItem('currentConversationId');
    }
    
    // 刷新页面显示
    setConversations(updatedConversations);
  };

  const setCurrentConversation = (id) => {
    localStorage.setItem('currentConversationId', id);
    router.push('/'); // 返回主页
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getMessagePreview = (messages) => {
    if (!messages || messages.length === 0) return '无消息';
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content || '';
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>助手对话历史</title>
        <meta name="description" content="查看和管理助手对话历史" />
        <link rel="icon" href="/icons/pdf-icon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">助手对话历史</h1>
            <Link href="/" className="text-blue-500 hover:text-blue-600 font-medium">
              返回主页
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-10 bg-white shadow-sm rounded-lg">
              <p className="text-gray-500">暂无对话历史</p>
              <Link href="/" className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
                开始新对话
              </Link>
            </div>
          ) : (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="grid grid-cols-1 divide-y">
                {conversations.map((conv) => (
                  <div key={conv.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-grow">
                        <h3 className="font-medium text-lg text-gray-800">{conv.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          创建于: {formatDate(conv.createdAt)}
                        </p>
                        <p className="text-gray-600 mt-2 break-words">
                          {getMessagePreview(conv.messages)}
                        </p>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => setCurrentConversation(conv.id)}
                          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                        >
                          继续对话
                        </button>
                        <button
                          onClick={() => deleteConversation(conv.id)}
                          className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      {conv.messages?.length || 0} 条消息
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 