import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import { ensureDir } from '../../utils/fileSystem';

// 禁用默认的bodyParser，以便我们可以使用formidable解析表单数据
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '只允许POST请求' });
  }

  try {
    // 确保上传目录存在
    const uploadDir = path.join(process.cwd(), 'uploads');
    await ensureDir(uploadDir);

    // 解析表单数据
    const form = new IncomingForm({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
    });

    // 处理上传的文件
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    // 获取上传的文件
    const file = files.file[0];
    
    // 检查文件类型
    if (!file.mimetype || file.mimetype !== 'application/pdf') {
      // 删除上传的非PDF文件
      fs.unlinkSync(file.filepath);
      return res.status(400).json({ success: false, error: '只能上传PDF文件' });
    }

    // 重命名文件，保持原始文件名
    const originalFilename = file.originalFilename;
    const newPath = path.join(uploadDir, originalFilename);
    
    // 如果已存在同名文件，先删除
    if (fs.existsSync(newPath)) {
      fs.unlinkSync(newPath);
    }
    
    // 移动文件
    fs.renameSync(file.filepath, newPath);

    // 返回成功响应
    return res.status(200).json({
      success: true,
      filename: originalFilename,
      path: newPath,
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    return res.status(500).json({ success: false, error: '文件上传失败: ' + error.message });
  }
} 