import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import MarkdownViewer from '../../components/MarkdownViewer';
import axios from 'axios';

export default function ViewFile() {
  const router = useRouter();
  const { filename } = router.query;
  
  const [markdownContent, setMarkdownContent] = useState('');
  const [basePath, setBasePath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (filename) {
      loadMarkdownContent(filename);
    }
  }, [filename]);

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Head>
        <title>{filename ? `${filename} - PDF处理系统` : 'PDF处理系统'}</title>
        <meta name="description" content="PDF处理与展示系统" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">PDF处理系统</h1>
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

      <main className="container mx-auto px-4 py-8 flex-grow">
        <div className="max-w-4xl mx-auto">
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
              <div className="mb-6 bg-white shadow-sm rounded-lg p-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">文件名: {filename}</h2>
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