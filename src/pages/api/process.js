import path from 'path';
import { processPdf } from '../../utils/processRunner';
import { addToHistory, isFileProcessed } from '../../utils/historyManager';
import { fileExists } from '../../utils/fileSystem';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '只允许POST请求' });
  }

  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ success: false, error: '缺少文件名参数' });
    }

    // 检查PDF文件是否存在
    const pdfPath = path.join(process.cwd(), 'uploads', filename);
    const fileExistsResult = await fileExists(pdfPath);
    
    if (!fileExistsResult) {
      return res.status(404).json({ success: false, error: '找不到PDF文件' });
    }

    // 检查文件是否已经处理过
    const alreadyProcessed = await isFileProcessed(filename);
    
    // 如果已经处理过，直接返回成功
    if (alreadyProcessed) {
      return res.status(200).json({
        success: true,
        filename,
        alreadyProcessed: true,
        message: '文件已经处理过',
      });
    }

    // 处理PDF文件
    const result = await processPdf(pdfPath);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || '处理PDF时出错',
      });
    }

    // 添加到历史记录
    await addToHistory(filename, {
      outputDir: result.outputDir,
      markdownPath: result.markdownPath,
    });

    // 返回成功响应
    return res.status(200).json({
      success: true,
      filename,
      outputDir: result.outputDir,
      markdownPath: result.markdownPath,
    });
  } catch (error) {
    console.error('处理PDF时出错:', error);
    return res.status(500).json({ success: false, error: '处理PDF时出错: ' + error.message });
  }
} 