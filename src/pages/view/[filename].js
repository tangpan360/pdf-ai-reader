import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import CopyableEditableMarkdown from '../../components/CopyableEditableMarkdown';
import axios from 'axios';

export default function ViewFile() {
  const router = useRouter();
  const { filename } = router.query;
  
  const [markdownContent, setMarkdownContent] = useState('');
  const [basePath, setBasePath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (filename) {
      loadMarkdownContent(filename);
    }
  }, [filename]);

  // 添加ESC键监听，退出全屏
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape' && isFullScreen) {
        exitFullScreen();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isFullScreen]);

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullScreenChange = () => {
      // 检查当前是否处于全屏状态
      const isCurrentlyFullScreen = !!(
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
      
      // 如果全屏状态与当前状态不一致，则更新状态
      if (isCurrentlyFullScreen !== isFullScreen) {
        setIsFullScreen(isCurrentlyFullScreen);
      }
    };
    
    // 添加各种浏览器的全屏变化事件监听
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', handleFullScreenChange);
    
    return () => {
      // 移除事件监听
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullScreenChange);
    };
  }, [isFullScreen]);

  const loadMarkdownContent = async (filename) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/content?filename=${encodeURIComponent(filename)}`);
      
      if (response.data.success) {
        setMarkdownContent(response.data.content);
        setBasePath(response.data.basePath);
      } else {
        setError(response.data.error || '加载Markdown内容失败');
      }
    } catch (err) {
      console.error('加载Markdown内容时出错:', err);
      setError('加载Markdown内容时出错: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (newContent) => {
    try {
      setSaveStatus('保存中...');
      const response = await axios.post('/api/save-content', {
        filename,
        content: newContent
      });

      if (response.data.success) {
        setSaveStatus('保存成功');
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        setSaveStatus('保存失败: ' + response.data.error);
      }
    } catch (err) {
      console.error('保存内容时出错:', err);
      setSaveStatus('保存失败: ' + err.message);
    }
  };

  const requestFullScreen = () => {
    const docEl = document.documentElement;
    
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen();
    } else if (docEl.mozRequestFullScreen) { // Firefox
      docEl.mozRequestFullScreen();
    } else if (docEl.webkitRequestFullscreen) { // Chrome, Safari, Opera
      docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) { // IE/Edge
      docEl.msRequestFullscreen();
    }
    
    setIsFullScreen(true);
  };
  
  const exitFullScreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { // Firefox
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { // Chrome, Safari, Opera
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { // IE/Edge
      document.msExitFullscreen();
    }
    
    setIsFullScreen(false);
  };

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      requestFullScreen();
    } else {
      exitFullScreen();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Head>
        <title>{filename ? `${filename} - PDF-AI-阅读系统` : 'PDF-AI-阅读系统'}</title>
        <meta name="description" content="PDF-AI-阅读系统" />
        <link rel="icon" href="/icons/pdf-icon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
      </Head>

      {/* 固定在顶部的导航栏 - 全屏模式下隐藏 */}
      {!isFullScreen && (
        <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-30">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">PDF-AI-阅读系统</h1>
            <div className="flex space-x-4">
              <Link href="/history" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium transition-colors">
                历史记录
              </Link>
              <Link href="/" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                返回主页
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* 全屏按钮 - 固定在左上角 */}
      <button
        onClick={toggleFullScreen}
        className={`fixed ${isFullScreen ? 'top-4' : 'top-20'} left-4 z-50 px-4 py-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 shadow-lg transition-colors`}
      >
        {isFullScreen ? '退出全屏' : '全屏显示'}
      </button>

      {/* 添加顶部空间，避免内容被固定导航栏遮挡 - 全屏模式下不需要 */}
      {!isFullScreen && <div className="pt-16"></div>}

      <main className="container mx-auto px-4 py-8 flex-grow">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">正在加载内容...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-md mb-6">
              <h3 className="text-lg font-medium mb-2">加载失败</h3>
              <p>{error}</p>
              <div className="mt-4">
                <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
                  返回主页
                </Link>
              </div>
            </div>
          ) : (
            <>
              {!isFullScreen && (
                <div className="mb-6 bg-white shadow-sm rounded-lg p-4 flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-800">文件名: {filename}</h2>
                  {saveStatus && (
                    <span className={`text-sm ${saveStatus.includes('失败') ? 'text-red-600' : 'text-green-600'}`}>
                      {saveStatus}
                    </span>
                  )}
                </div>
              )}
              
              <CopyableEditableMarkdown
                initialContent={markdownContent}
                onSave={handleSave}
                basePath={basePath}
                isFullScreen={isFullScreen}
              />
            </>
          )}
        </div>
      </main>

      {!isFullScreen && (
        <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
          <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} PDF处理系统
          </div>
        </footer>
      )}
    </div>
  );
} 