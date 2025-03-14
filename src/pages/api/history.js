import { getHistory } from '../../utils/historyManager';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: '只允许GET请求' });
  }

  try {
    // 获取历史记录
    const history = await getHistory();
    
    // 按时间戳降序排序（最新的在前面）
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // 返回成功响应
    return res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('获取历史记录时出错:', error);
    return res.status(500).json({ success: false, error: '获取历史记录时出错: ' + error.message });
  }
} 