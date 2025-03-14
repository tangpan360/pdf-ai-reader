import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const existsAsync = promisify(fs.exists);

/**
 * 运行PDF处理命令
 * @param {string} filename - PDF文件名
 * @returns {Promise<Object>} - 处理结果
 */
export const processPdf = async (filename) => {
  try {
    // 提取文件名（不含扩展名）
    const fileNameWithoutExt = path.basename(filename, path.extname(filename));
    
    // 构建输出路径
    const outputDir = path.join(process.cwd(), 'output', fileNameWithoutExt, 'auto');
    const markdownPath = path.join(outputDir, `${fileNameWithoutExt}.md`);
    const imagesDir = path.join(outputDir, 'images');
    
    // 构建命令 - 使用 source 命令来正确激活 conda 环境
    const fullCommand = `source /home/iip/miniconda3/etc/profile.d/conda.sh && conda activate mineru && magic-pdf -p "${filename}" -o output -m auto`;
    
    console.log(`执行命令: ${fullCommand}`);
    
    // 在bash中执行命令
    const { stdout, stderr } = await execAsync(fullCommand, {
      shell: '/bin/bash',
      cwd: process.cwd(), // 在当前工作目录执行
    });
    
    // 检查输出目录是否存在，作为处理成功的标志
    const outputExists = await existsAsync(outputDir);
    
    if (!outputExists) {
      console.error('处理PDF失败，输出目录不存在:', outputDir);
      throw new Error('处理PDF失败，输出目录不存在');
    }
    
    // 检查是否有严重错误（不包括警告和信息日志）
    if (stderr && stderr.includes('Error:') && !stderr.includes('local output dir is')) {
      console.error('处理PDF时出错:', stderr);
      throw new Error(`处理PDF时出错: ${stderr}`);
    }
    
    console.log('处理PDF成功，输出目录:', outputDir);
    
    return {
      success: true,
      outputDir,
      markdownPath,
      imagesDir,
      fileNameWithoutExt,
    };
  } catch (error) {
    console.error('执行PDF处理命令失败:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}; 