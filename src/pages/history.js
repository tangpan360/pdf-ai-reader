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
        <title>历史记录 - PDF-AI-阅读系统</title>
        <meta name="description" content="PDF-AI-阅读系统历史记录" />
        <link rel="icon" href="/icons/pdf-icon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
      </Head>

      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-30">
        <div className="container-fluid w-full px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <svg className="w-8 h-8 mr-2 text-red-600" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
              <path d="M910.2336 1024H113.7664C51.2 1024 0 972.8 0 910.2336V113.7664C0 51.2 51.2 0 113.7664 0h796.4672C972.8 0 1024 51.2 1024 113.7664v796.4672C1024 972.8 972.8 1024 910.2336 1024zM155.2128 555.4432h44.672c35.9936 1.2032 66.0224-8.704 89.984-29.6704 24.0128-20.9664 36.0192-48.3328 36.0192-82.1248 0-33.28-10.24-58.9568-30.7712-76.8768-20.5312-17.92-49.3568-26.88-86.5536-26.88h-97.792v344.2432h44.4416v-128.6912z m0-176.4352h45.3376c52.48 0 78.6688 22.1184 78.6688 66.432 0 22.8096-7.04 40.3456-21.12 52.5824-14.08 12.1856-34.6624 18.304-61.7728 18.304H155.2128v-137.3184z m234.0352 305.1008h94.6432c54.528 0 99.072-16.0768 133.6576-48.2048 34.6112-32.1536 51.8912-74.9056 51.8912-128.256 0-51.0976-17.28-91.8528-51.8912-122.2144-34.56-30.336-77.952-45.568-130.0992-45.568h-98.2016v344.2432z m44.416-304.6656h51.9936c41.0624 0 74.1632 10.8032 99.328 32.4608 25.216 21.6064 37.7856 53.888 37.7856 96.8704 0 43.008-12.2368 76.3392-36.7872 100.224-24.5248 23.8592-58.624 35.7632-102.3232 35.7632H433.664V379.4432z m479.5648 0v-39.5776h-177.3312v344.2432h44.4416v-150.4512h123.1104V494.592h-123.136v-115.1232h132.9152z" fill="currentColor"/>
            </svg>
            PDF-AI-阅读系统
          </h1>
          <Link href="/" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            返回主页
          </Link>
        </div>
      </header>

      <div className="pt-16"></div>

      <main className="container-fluid w-full px-4 py-8 flex-grow">
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
        <div className="container-fluid w-full px-4 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} PDF-AI-阅读系统
        </div>
      </footer>
    </div>
  );
} 