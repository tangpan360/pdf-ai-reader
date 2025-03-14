import path from 'path';
import { deleteFile, deleteDirectory, fileExists } from '../../utils/fileSystem';
import { removeFromHistory } from '../../utils/historyManager';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: '只允许DELETE请求' });
  }

  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ success: false, error: '缺少文件名参数' });
    }

    // 提取文件名（不含扩展名）
    const fileNameWithoutExt = path.basename(filename, path.extname(filename));
    
    // 构建文件路径
    const pdfPath = path.join(process.cwd(), 'uploads', filename);
    const outputDir = path.join(process.cwd(), 'output', fileNameWithoutExt);
    
    // 删除PDF文件
    const pdfExists = await fileExists(pdfPath);
    if (pdfExists) {
      await deleteFile(pdfPath);
    }
    
    // 删除输出目录
    const outputExists = await fileExists(outputDir);
    if (outputExists) {
      await deleteDirectory(outputDir);
    }
    
    // 从历史记录中删除
    await removeFromHistory(filename);

    // 返回成功响应
    return res.status(200).json({
      success: true,
      message: '文件删除成功',
    });
  } catch (error) {
    console.error('删除文件时出错:', error);
    return res.status(500).json({ success: false, error: '删除文件时出错: ' + error.message });
  }
} 