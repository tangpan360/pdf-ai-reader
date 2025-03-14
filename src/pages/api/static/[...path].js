import fs from 'fs';
import path from 'path';
import { fileExists } from '../../../utils/fileSystem';

export default async function handler(req, res) {
  const { path: filePath } = req.query;
  
  // 构建完整的文件路径
  const fullPath = path.join(process.cwd(), 'output', ...filePath);
  
  try {
    // 检查文件是否存在
    const exists = await fileExists(fullPath);
    
    if (!exists) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }
    
    // 获取文件的MIME类型
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    // 设置常见文件类型的Content-Type
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.md':
        contentType = 'text/markdown';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
      case '.html':
        contentType = 'text/html';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.js':
        contentType = 'application/javascript';
        break;
    }
    
    // 设置响应头
    res.setHeader('Content-Type', contentType);
    
    // 创建文件读取流并将其管道连接到响应
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('提供静态文件时出错:', error);
    return res.status(500).json({ success: false, error: '提供静态文件时出错: ' + error.message });
  }
} 