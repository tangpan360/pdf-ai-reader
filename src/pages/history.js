import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/history');
      if (response.data.success) {
        setHistory(response.data.history);
      } else {
        setError('获取历史记录失败');
      }
    } catch (err) {
      console.error('获取历史记录时出错:', err);
      setError('获取历史记录时出错: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename) => {
    try {
      const response = await axios.delete('/api/delete', {
        data: { filename },
      });

      if (response.data.success) {
        fetchHistory();
      } else {
        console.error('删除文件失败:', response.data.error || '未知错误');
      }
    } catch (err) {
      console.error('删除文件时出错:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Head>
        <title>历史记录 - PDF处理系统</title>
        <meta name="description" content="PDF处理与展示系统历史记录" />
        <link rel="icon" href="/icons/pdf-icon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
      </Head>

      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-30">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">PDF处理系统</h1>
          <Link href="/" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            返回主页
          </Link>
        </div>
      </header>

      <div className="pt-16"></div>

      <main className="container mx-auto px-4 py-8 flex-grow">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">处理历史记录</h2>
          
          {loading ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-500 border-t-transparent"></div>
              <p className="mt-2 text-sm text-gray-600">加载历史记录...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          ) : history.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-5 rounded-md text-center">
              暂无处理记录
            </div>
          ) : (
            <div className="bg-white shadow-md rounded-lg">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[65%] px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      文件名
                    </th>
                    <th className="w-[20%] px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      处理时间
                    </th>
                    <th className="w-[15%] px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((item) => (
                    <tr key={item.filename} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="truncate" title={item.filename}>
                          <Link href={`/view/${encodeURIComponent(item.filename)}`} className="text-blue-600 hover:text-blue-900 hover:underline">
                            {item.filename}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 truncate text-center">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td className="px-2 py-4 text-sm font-medium whitespace-nowrap text-center">
                        <Link href={`/view/${encodeURIComponent(item.filename)}`} className="text-blue-600 hover:text-blue-900 mr-1">
                          查看
                        </Link>
                        <button
                          onClick={() => handleDelete(item.filename)}
                          className="text-red-600 hover:text-red-900 ml-1"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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