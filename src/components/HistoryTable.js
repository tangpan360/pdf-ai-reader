import React, { useState, useEffect } from 'react';
import axios from 'axios';

const HistoryTable = ({ onViewFile, onRefresh, refreshTrigger }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  const handleDelete = async (filename) => {
    try {
      const response = await axios.delete('/api/delete', {
        data: { filename },
      });

      if (response.data.success) {
        fetchHistory();
        if (onRefresh) onRefresh();
      } else {
        console.error('删除文件失败:', response.data.error || '未知错误');
      }
    } catch (err) {
      console.error('删除文件时出错:', err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-500 border-t-transparent"></div>
        <p className="mt-2 text-sm text-gray-600">加载历史记录...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-5 rounded-md text-center">
        暂无处理记录
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-800">处理历史</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                文件名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                处理时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map((item) => (
              <tr key={item.filename} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.filename}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(item.timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onViewFile(item.filename)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    查看
                  </button>
                  <button
                    onClick={() => handleDelete(item.filename)}
                    className="text-red-600 hover:text-red-900"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryTable; 