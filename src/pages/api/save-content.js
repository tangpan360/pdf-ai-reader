import path from 'path';
import fs from 'fs/promises';
import { fileExists } from '../../utils/fileSystem';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '只允许POST请求' });
  }

  try {
    const { filename, content } = req.body;

    if (!filename || content === undefined) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
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

    // 保存新内容
    await fs.writeFile(markdownPath, content, 'utf8');

    // 返回成功响应
    return res.status(200).json({
      success: true,
      message: '内容保存成功',
    });
  } catch (error) {
    console.error('保存内容时出错:', error);
    return res.status(500).json({ success: false, error: '保存内容时出错: ' + error.message });
  }
} 