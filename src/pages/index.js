import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import FileUploader from '../components/FileUploader';
import ProcessingStatus from '../components/ProcessingStatus';
import MarkdownViewer from '../components/MarkdownViewer';
import axios from 'axios';

export default function Home() {
  const [currentFile, setCurrentFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const [basePath, setBasePath] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState('');

  // 页面加载时从 localStorage 恢复状态
  useEffect(() => {
    const savedState = localStorage.getItem('pdfProcessorState');
    if (savedState) {
      const state = JSON.parse(savedState);
      setCurrentFile(state.currentFile);
      setIsProcessing(state.isProcessing);
      
      if (state.markdownContent) {
        setMarkdownContent(state.markdownContent);
        setBasePath(state.basePath);
      } else if (state.currentFile && state.isProcessing) {
        // 如果有文件正在处理但没有内容，检查处理状态
        checkProcessingStatus(state.currentFile);
      }
    }
  }, []);

  // 保存状态到 localStorage
  const saveState = (state) => {
    localStorage.setItem('pdfProcessorState', JSON.stringify(state));
  };

  // 检查处理状态
  const checkProcessingStatus = async (filename) => {
    try {
      // 尝试获取内容，如果成功则表示处理已完成
      const response = await axios.get(`/api/content?filename=${encodeURIComponent(filename)}`);
      
      if (response.data.success) {
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
        setIsProcessing(true);
      }
    } catch (err) {
      // 出错时保持处理状态
      console.error('检查处理状态时出错:', err);
    }
  };

  const handleUploadSuccess = (filename) => {
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
    
    // 保存状态
    saveState({
      currentFile,
      isProcessing: true,
      markdownContent: '',
      basePath: ''
    });
  };

  const handleProcessingComplete = (data) => {
    setIsProcessing(false);
    
    if (data.success) {
      // 触发历史记录刷新
      setRefreshTrigger(prev => prev + 1);
      
      // 加载Markdown内容
      loadMarkdownContent(data.filename);
    } else {
      setError(data.error || '处理PDF时出错');
      
      // 保存错误状态
      saveState({
        currentFile,
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Head>
        <title>PDF处理系统</title>
        <meta name="description" content="PDF处理与展示系统" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white shadow-sm">
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

      <main className="container mx-auto px-4 py-8 flex-grow">
        <div className="max-w-4xl mx-auto">
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
              <div className="mb-6 bg-white shadow-sm rounded-lg p-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">文件名: {currentFile}</h2>
              </div>
              
              <MarkdownViewer
                content={markdownContent}
                basePath={basePath}
              />
            </>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} PDF处理系统
        </div>
      </footer>
    </div>
  );
} 