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
  const [lastCheckTime, setLastCheckTime] = useState(0);

  // 页面加载时从 localStorage 恢复状态
  useEffect(() => {
    const savedState = localStorage.getItem('pdfProcessorState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        setCurrentFile(state.currentFile);
        setIsProcessing(state.isProcessing);
        
        if (state.markdownContent) {
          setMarkdownContent(state.markdownContent);
          setBasePath(state.basePath);
        } else if (state.currentFile && state.isProcessing) {
          // 如果有文件正在处理但没有内容，检查处理状态
          console.log("检测到处理状态，正在检查:", state.currentFile);
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

  // 如果在处理中，定期检查处理状态
  useEffect(() => {
    let interval;
    
    if (isProcessing && currentFile) {
      // 设置定期检查，每3秒检查一次
      interval = setInterval(() => {
        console.log("定期检查处理状态:", currentFile);
        checkProcessingStatus(currentFile);
        setLastCheckTime(Date.now());
      }, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, currentFile, lastCheckTime]);

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

  // 保存状态到 localStorage
  const saveState = (state) => {
    console.log("保存状态:", state);
    localStorage.setItem('pdfProcessorState', JSON.stringify(state));
  };

  // 检查处理状态
  const checkProcessingStatus = async (filename) => {
    if (!filename) return;
    
    try {
      console.log("正在检查文件处理状态:", filename);
      // 尝试获取内容，如果成功则表示处理已完成
      const response = await axios.get(`/api/content?filename=${encodeURIComponent(filename)}`);
      
      if (response.data.success) {
        console.log("文件处理已完成:", filename);
        setMarkdownContent(response.data.content);
        setBasePath(response.data.basePath);
        setIsProcessing(false);
        
        // 更新保存的状态
        saveState({
          currentFile: filename,
          isProcessing: false,
          markdownContent: response.data.content,
          basePath: response.data.basePath
        });
      } else {
        // 内容获取失败，可能仍在处理中
        console.log("文件仍在处理中:", filename);
        setIsProcessing(true);
        
        // 确保currentFile是最新的
        setCurrentFile(filename);
        
        // 更新保存的状态
        saveState({
          currentFile: filename,
          isProcessing: true,
          markdownContent: '',
          basePath: ''
        });
      }
    } catch (err) {
      // 出错时保持处理状态
      console.error('检查处理状态时出错:', err);
      // 尝试再次保存状态，确保文件名未丢失
      saveState({
        currentFile: filename,
        isProcessing: true,
        markdownContent: '',
        basePath: ''
      });
    }
  };

  const handleUploadSuccess = (filename) => {
    console.log("文件上传成功:", filename);
    setCurrentFile(filename);
    setMarkdownContent('');
    setError('');
    
    // 保存状态
    saveState({
      currentFile: filename,
      isProcessing: false,
      markdownContent: '',
      basePath: ''
    });
  };

  const handleProcessingStart = () => {
    setIsProcessing(true);
    setError('');
    
    // 确保currentFile有值并保存在状态中
    if (currentFile) {
      console.log("开始处理文件:", currentFile);
      
      // 保存状态
      saveState({
        currentFile: currentFile,
        isProcessing: true,
        markdownContent: '',
        basePath: ''
      });
    }
  };

  const handleProcessingComplete = (data) => {
    console.log("文件处理完成:", data);
    setIsProcessing(false);
    
    if (data.success) {
      // 触发历史记录刷新
      setRefreshTrigger(prev => prev + 1);
      
      // 确保设置当前文件名
      if (data.filename) {
        setCurrentFile(data.filename);
      }
      
      // 加载Markdown内容
      loadMarkdownContent(data.filename);
    } else {
      setError(data.error || '处理PDF时出错');
      
      // 保存错误状态
      saveState({
        currentFile: currentFile || data.filename,
        isProcessing: false,
        markdownContent: '',
        basePath: '',
        error: data.error || '处理PDF时出错'
      });
    }
  };

  const loadMarkdownContent = async (filename) => {
    try {
      const response = await axios.get(`/api/content?filename=${encodeURIComponent(filename)}`);
      
      if (response.data.success) {
        setMarkdownContent(response.data.content);
        setBasePath(response.data.basePath);
        
        // 保存状态
        saveState({
          currentFile: filename,
          isProcessing: false,
          markdownContent: response.data.content,
          basePath: response.data.basePath
        });
      } else {
        setError(response.data.error || '加载Markdown内容失败');
        
        // 保存错误状态
        saveState({
          currentFile: filename,
          isProcessing: false,
          markdownContent: '',
          basePath: '',
          error: response.data.error || '加载Markdown内容失败'
        });
      }
    } catch (err) {
      console.error('加载Markdown内容时出错:', err);
      setError('加载Markdown内容时出错: ' + err.message);
      
      // 保存错误状态
      saveState({
        currentFile: filename,
        isProcessing: false,
        markdownContent: '',
        basePath: '',
        error: '加载Markdown内容时出错: ' + err.message
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
        <title>PDF-AI-阅读系统</title>
        <meta name="description" content="PDF-AI-阅读系统" />
        <link rel="icon" href="/icons/pdf-icon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
      </Head>

      {/* 固定在顶部的导航栏 - 全屏模式下隐藏 */}
      {!isFullScreen && (
        <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-30">
          <div className="container-fluid w-full px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">PDF-AI-阅读系统</h1>
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

      <main className="container-fluid w-full px-4 py-8 flex-grow">
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
          <div className="container-fluid w-full px-4 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} PDF-AI-阅读系统
          </div>
        </footer>
      )}
    </div>
  );
} 