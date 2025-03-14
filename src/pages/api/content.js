import path from 'path';
import { readMarkdownFile, fileExists } from '../../utils/fileSystem';
import { getHistory } from '../../utils/historyManager';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: '只允许GET请求' });
  }

  try {
    const { filename } = req.query;

    if (!filename) {
      return res.status(400).json({ success: false, error: '缺少文件名参数' });
    }

    // 获取历史记录
    const history = await getHistory();
    const fileRecord = history.find(item => item.filename === filename);

    if (!fileRecord) {
      return res.status(404).json({ success: false, error: '找不到文件处理记录' });
    }

    // 提取文件名（不含扩展名）
    const fileNameWithoutExt = path.basename(filename, path.extname(filename));
    
    // 构建Markdown文件路径
    const markdownPath = path.join(process.cwd(), 'output', fileNameWithoutExt, 'auto', `${fileNameWithoutExt}.md`);
    
    // 检查Markdown文件是否存在
    const markdownExists = await fileExists(markdownPath);
    
    if (!markdownExists) {
      return res.status(404).json({ success: false, error: '找不到Markdown文件' });
    }

    // 读取Markdown内容
    const content = await readMarkdownFile(markdownPath);
    
    // 构建图片基础路径
    const basePath = `/output/${fileNameWithoutExt}/auto`;

    // 返回成功响应
    return res.status(200).json({
      success: true,
      filename,
      content,
      basePath,
    });
  } catch (error) {
    console.error('获取Markdown内容时出错:', error);
    return res.status(500).json({ success: false, error: '获取Markdown内容时出错: ' + error.message });
  }
} 