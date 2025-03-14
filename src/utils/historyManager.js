import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const fileExistsAsync = promisify(fs.access);

const HISTORY_FILE = path.join(process.cwd(), 'history.json');

/**
 * 确保历史记录文件存在
 */
const ensureHistoryFile = async () => {
  try {
    await fileExistsAsync(HISTORY_FILE);
  } catch (error) {
    // 文件不存在，创建一个空的历史记录文件
    await writeFileAsync(HISTORY_FILE, JSON.stringify([], null, 2));
  }
};

/**
 * 获取所有历史记录
 * @returns {Promise<Array>} 历史记录数组
 */
export const getHistory = async () => {
  await ensureHistoryFile();
  
  try {
    const data = await readFileAsync(HISTORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取历史记录失败:', error);
    return [];
  }
};

/**
 * 添加处理记录到历史
 * @param {string} filename - PDF文件名
 * @param {Object} metadata - 额外的元数据
 * @returns {Promise<boolean>} 是否成功添加
 */
export const addToHistory = async (filename, metadata = {}) => {
  try {
    const history = await getHistory();
    
    // 检查是否已存在相同文件名的记录
    const existingIndex = history.findIndex(item => item.filename === filename);
    
    const newEntry = {
      filename,
      timestamp: new Date().toISOString(),
      ...metadata
    };
    
    if (existingIndex !== -1) {
      // 更新现有记录
      history[existingIndex] = newEntry;
    } else {
      // 添加新记录
      history.push(newEntry);
    }
    
    // 保存更新后的历史记录
    await writeFileAsync(HISTORY_FILE, JSON.stringify(history, null, 2));
    return true;
  } catch (error) {
    console.error('添加历史记录失败:', error);
    return false;
  }
};

/**
 * 从历史记录中删除条目
 * @param {string} filename - 要删除的PDF文件名
 * @returns {Promise<boolean>} 是否成功删除
 */
export const removeFromHistory = async (filename) => {
  try {
    const history = await getHistory();
    const newHistory = history.filter(item => item.filename !== filename);
    
    // 保存更新后的历史记录
    await writeFileAsync(HISTORY_FILE, JSON.stringify(newHistory, null, 2));
    return true;
  } catch (error) {
    console.error('删除历史记录失败:', error);
    return false;
  }
};

/**
 * 检查文件是否已经处理过
 * @param {string} filename - PDF文件名
 * @returns {Promise<boolean>} 是否已处理
 */
export const isFileProcessed = async (filename) => {
  const history = await getHistory();
  return history.some(item => item.filename === filename);
}; 