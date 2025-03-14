import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// 将回调函数转换为Promise
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const unlinkAsync = promisify(fs.unlink);
const rmdirAsync = promisify(fs.rmdir);

// 确保目录存在
export const ensureDir = async (dirPath) => {
  try {
    await statAsync(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await mkdirAsync(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
};

// 读取Markdown文件
export const readMarkdownFile = async (filePath) => {
  try {
    const content = await readFileAsync(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error(`读取Markdown文件失败: ${filePath}`, error);
    throw new Error(`读取Markdown文件失败: ${error.message}`);
  }
};

// 删除文件
export const deleteFile = async (filePath) => {
  try {
    await unlinkAsync(filePath);
  } catch (error) {
    console.error(`删除文件失败: ${filePath}`, error);
    throw new Error(`删除文件失败: ${error.message}`);
  }
};

// 递归删除目录
export const deleteDirectory = async (dirPath) => {
  try {
    const entries = await readdirAsync(dirPath, { withFileTypes: true });
    
    // 先删除目录中的所有文件和子目录
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await deleteDirectory(fullPath);
      } else {
        await unlinkAsync(fullPath);
      }
    }
    
    // 删除空目录
    await rmdirAsync(dirPath);
  } catch (error) {
    console.error(`删除目录失败: ${dirPath}`, error);
    throw new Error(`删除目录失败: ${error.message}`);
  }
};

// 获取文件扩展名
export const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase();
};

// 检查文件是否存在
export const fileExists = async (filePath) => {
  try {
    await statAsync(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}; 