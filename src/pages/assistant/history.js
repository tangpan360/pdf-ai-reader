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
        <title>助手对话历史 - PDF-AI-阅读系统</title>
        <meta name="description" content="查看和管理PDF-AI-阅读系统助手对话历史" />
        <link rel="icon" href="/icons/pdf-icon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white shadow-sm">
        <div className="container-fluid w-full px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <svg className="w-8 h-8 mr-2 text-red-600" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                <path d="M910.2336 1024H113.7664C51.2 1024 0 972.8 0 910.2336V113.7664C0 51.2 51.2 0 113.7664 0h796.4672C972.8 0 1024 51.2 1024 113.7664v796.4672C1024 972.8 972.8 1024 910.2336 1024zM155.2128 555.4432h44.672c35.9936 1.2032 66.0224-8.704 89.984-29.6704 24.0128-20.9664 36.0192-48.3328 36.0192-82.1248 0-33.28-10.24-58.9568-30.7712-76.8768-20.5312-17.92-49.3568-26.88-86.5536-26.88h-97.792v344.2432h44.4416v-128.6912z m0-176.4352h45.3376c52.48 0 78.6688 22.1184 78.6688 66.432 0 22.8096-7.04 40.3456-21.12 52.5824-14.08 12.1856-34.6624 18.304-61.7728 18.304H155.2128v-137.3184z m234.0352 305.1008h94.6432c54.528 0 99.072-16.0768 133.6576-48.2048 34.6112-32.1536 51.8912-74.9056 51.8912-128.256 0-51.0976-17.28-91.8528-51.8912-122.2144-34.56-30.336-77.952-45.568-130.0992-45.568h-98.2016v344.2432z m44.416-304.6656h51.9936c41.0624 0 74.1632 10.8032 99.328 32.4608 25.216 21.6064 37.7856 53.888 37.7856 96.8704 0 43.008-12.2368 76.3392-36.7872 100.224-24.5248 23.8592-58.624 35.7632-102.3232 35.7632H433.664V379.4432z m479.5648 0v-39.5776h-177.3312v344.2432h44.4416v-150.4512h123.1104V494.592h-123.136v-115.1232h132.9152z" fill="currentColor"/>
              </svg>
              PDF-AI-阅读系统 - 助手对话历史
            </h1>
            <Link href="/" className="text-blue-500 hover:text-blue-600 font-medium">
              返回主页
            </Link>
          </div>
        </div>
      </header>

      <main className="container-fluid w-full px-4 py-8">
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