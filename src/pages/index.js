import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import FileUploader from '../components/FileUploader';
import ProcessingStatus from '../components/ProcessingStatus';
import CopyableEditableMarkdown from '../components/CopyableEditableMarkdown';
import axios from 'axios';

export default function Home() {
  const [currentFile, setCurrentFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const [basePath, setBasePath] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // 页面加载时从 localStorage 恢复状态，添加更强健的状态恢复逻辑
  useEffect(() => {
    const savedState = localStorage.getItem('pdfProcessorState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        console.log("恢复状态:", state); // 调试日志
        
        if (state.currentFile) {
          setCurrentFile(state.currentFile);
        }
        
        if (state.isProcessing !== undefined) {
          setIsProcessing(state.isProcessing);
        }
        
        if (state.markdownContent) {
          setMarkdownContent(state.markdownContent);
          setBasePath(state.basePath || '');
        } else if (state.currentFile && state.isProcessing) {
          // 如果有文件正在处理但没有内容，检查处理状态
          checkProcessingStatus(state.currentFile);
        }
        
        if (state.error) {
          setError(state.error);
        }
      } catch (err) {
        console.error("恢复状态时出错:", err);
        localStorage.removeItem('pdfProcessorState');
      }
    }
  }, []);

  // 添加轮询机制，定期检查处理状态
  useEffect(() => {
    let intervalId;
    
    if (currentFile && isProcessing) {
      console.log("启动轮询检查处理状态，文件:", currentFile); // 调试日志
      
      // 每5秒钟检查一次处理状态
      intervalId = setInterval(() => {
        checkProcessingStatus(currentFile);
      }, 5000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentFile, isProcessing]);

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

  // 改进保存状态的函数，确保所有关键字段都被保存
  const saveState = (state) => {
    // 确保合并现有状态，而不是完全覆盖
    const currentState = JSON.parse(localStorage.getItem('pdfProcessorState') || '{}');
    const newState = { ...currentState, ...state };
    
    console.log("保存状态:", newState); // 调试日志
    
    localStorage.setItem('pdfProcessorState', JSON.stringify(newState));
  };

  // 改进检查处理状态的函数，添加更多调试信息和错误处理
  const checkProcessingStatus = async (filename) => {
    if (!filename) {
      console.error("checkProcessingStatus: 文件名为空");
      return;
    }
    
    console.log("检查处理状态:", filename); // 调试日志
    
    try {
      // 尝试获取内容，如果成功则表示处理已完成
      const response = await axios.get(`/api/content?filename=${encodeURIComponent(filename)}`);
      
      if (response.data.success) {
        console.log("处理完成，加载内容:", filename);
        setMarkdownContent(response.data.content);
        setBasePath(response.data.basePath || '');
        setIsProcessing(false);
        
        // 更新保存的状态
        saveState({
          currentFile: filename,
          isProcessing: false,
          markdownContent: response.data.content,
          basePath: response.data.basePath || ''
        });
      } else {
        // 内容获取失败，可能仍在处理中，保持处理状态
        console.log("内容获取失败，保持处理状态:", filename);
        
        // 确保文件名被保存
        setCurrentFile(filename);
        setIsProcessing(true);
        
        // 更新保存状态，确保文件名存在
        saveState({
          currentFile: filename,
          isProcessing: true
        });
      }
    } catch (err) {
      // 处理错误，但保持处理状态
      console.error(`检查处理状态时出错(${filename}):`, err);
      
      // 确保文件名被保存
      setCurrentFile(filename);
      setIsProcessing(true);
      
      // 更新保存状态
      saveState({
        currentFile: filename,
        isProcessing: true,
        error: `检查处理状态时出错: ${err.message}`
      });
    }
  };

  // 改进上传成功的处理，确保文件名被正确保存
  const handleUploadSuccess = (filename) => {
    console.log("上传成功:", filename); // 调试日志
    
    setCurrentFile(filename);
    setMarkdownContent('');
    setError('');
    
    // 保存状态，确保包含文件名
    saveState({
      currentFile: filename,
      isProcessing: false,
      markdownContent: '',
      basePath: ''
    });
  };

  // 改进处理开始的处理，确保状态中包含文件名
  const handleProcessingStart = () => {
    console.log("开始处理文件:", currentFile); // 调试日志
    
    setIsProcessing(true);
    setError('');
    
    // 保存状态，确保包含文件名
    saveState({
      currentFile: currentFile, // 明确使用当前的文件名
      isProcessing: true,
      markdownContent: '',
      basePath: ''
    });
  };

  const handleProcessingComplete = (data) => {
    console.log("处理完成:", data); // 调试日志
    
    setIsProcessing(false);
    
    if (data.success) {
      // 触发历史记录刷新
      setRefreshTrigger(prev => prev + 1);
      
      // 确保文件名正确
      if (data.filename && (!currentFile || currentFile !== data.filename)) {
        setCurrentFile(data.filename);
      }
      
      // 加载Markdown内容
      loadMarkdownContent(data.filename || currentFile);
    } else {
      const errorMessage = data.error || '处理PDF时出错';
      setError(errorMessage);
      
      // 保存错误状态，确保包含文件名
      saveState({
        currentFile: currentFile || data.filename,
        isProcessing: false,
        markdownContent: '',
        basePath: '',
        error: errorMessage
      });
    }
  };

  const loadMarkdownContent = async (filename) => {
    if (!filename) {
      console.error("loadMarkdownContent: 文件名为空");
      setError("无法加载内容：文件名缺失");
      return;
    }
    
    console.log("加载Markdown内容:", filename); // 调试日志
    
    try {
      const response = await axios.get(`/api/content?filename=${encodeURIComponent(filename)}`);
      
      if (response.data.success) {
        console.log("内容加载成功:", filename);
        setMarkdownContent(response.data.content);
        setBasePath(response.data.basePath || '');
        setError(''); // 清除可能存在的错误
        
        // 保存状态
        saveState({
          currentFile: filename,
          isProcessing: false,
          markdownContent: response.data.content,
          basePath: response.data.basePath || '',
          error: '' // 清除错误
        });
      } else {
        const errorMessage = response.data.error || '加载Markdown内容失败';
        console.error("内容加载失败:", errorMessage);
        setError(errorMessage);
        
        // 保存错误状态
        saveState({
          currentFile: filename,
          isProcessing: false,
          markdownContent: '',
          basePath: '',
          error: errorMessage
        });
      }
    } catch (err) {
      const errorMessage = '加载Markdown内容时出错: ' + err.message;
      console.error(errorMessage);
      setError(errorMessage);
      
      // 保存错误状态
      saveState({
        currentFile: filename,
        isProcessing: false,
        markdownContent: '',
        basePath: '',
        error: errorMessage
      });
    }
  };

  // 清除当前内容，准备上传新文件
  const handleNewUpload = () => {
    setCurrentFile(null);
    setMarkdownContent('');
    setBasePath('');
    setError('');
    
    // 清除保存的状态
    localStorage.removeItem('pdfProcessorState');
  };

  const handleSave = async (newContent) => {
    try {
      setSaveStatus('保存中...');
      const response = await axios.post('/api/save-content', {
        filename: currentFile,
        content: newContent
      });

      if (response.data.success) {
        setSaveStatus('保存成功');
        setMarkdownContent(newContent);
        
        // 更新保存的状态
        saveState({
          currentFile,
          isProcessing: false,
          markdownContent: newContent,
          basePath
        });
        
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
        <title>PDF处理系统</title>
        <meta name="description" content="PDF处理与展示系统" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* 固定在顶部的导航栏 - 全屏模式下隐藏 */}
      {!isFullScreen && (
        <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-30">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">PDF处理系统</h1>
            <div className="flex space-x-4">
              {markdownContent && (
                <button 
                  onClick={handleNewUpload}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  上传新文件
                </button>
              )}
              <Link href="/history" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                查看历史记录
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* 全屏按钮 - 固定在左上角 */}
      {markdownContent && (
        <button
          onClick={toggleFullScreen}
          className={`fixed ${isFullScreen ? 'top-4' : 'top-20'} left-4 z-50 px-4 py-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 shadow-lg transition-colors`}
        >
          {isFullScreen ? '退出全屏' : '全屏显示'}
        </button>
      )}

      {/* 添加顶部空间，避免内容被固定导航栏遮挡 - 全屏模式下不需要 */}
      {!isFullScreen && <div className="pt-16"></div>}

      <main className="container mx-auto px-4 py-8 flex-grow">
        <div className="max-w-6xl mx-auto">
          {!markdownContent && (
            <>
              <FileUploader
                onUploadSuccess={handleUploadSuccess}
                onProcessingStart={handleProcessingStart}
                onProcessingComplete={handleProcessingComplete}
              />
              
              <ProcessingStatus
                isProcessing={isProcessing}
                filename={currentFile}
              />
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
                  {error}
                </div>
              )}
            </>
          )}
          
          {markdownContent && (
            <>
              {!isFullScreen && (
                <div className="mb-6 bg-white shadow-sm rounded-lg p-4 flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-800">文件名: {currentFile}</h2>
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