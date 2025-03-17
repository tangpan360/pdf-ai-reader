import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { copyToClipboard, showCopyNotification } from '../utils/copyUtils';
import remarkGfm from 'remark-gfm';
import katex from 'katex';

// 文本预处理函数，用于保护特定的列表格式，防止被自动转换
const preprocessMarkdown = (text) => {
  if (!text) return text;
  
  // 添加一个不可见的字符到")"前面，防止被识别为列表
  // 这样类似 "1) My love..." 的格式会被保留
  return text.replace(/^(\d+)(\))/gm, '$1\u200B$2');
};

// 自定义remark插件，用于保留原始列表格式
const remarkPreserveListFormat = () => {
  return (tree) => {
    // 递归遍历语法树
    function visit(node) {
      // 如果是有序列表的列表项，检查原始文本以保留格式
      if (node.type === 'list' && node.ordered) {
        // 为列表项添加一个标记，表示使用原始格式
        node.data = node.data || {};
        node.data.hProperties = node.data.hProperties || {};
        node.data.hProperties.preserveFormat = true;
      }
      
      // 递归处理子节点
      if (node.children) {
        node.children.forEach(visit);
      }
    }
    
    visit(tree);
  };
};

const CopyableEditableMarkdown = ({ initialContent, onSave, basePath, isFullScreen }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [originalContent, setOriginalContent] = useState(initialContent);
  const editorRef = useRef(null);
  const previewRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);

  // 复制功能
  const handleCopy = useCallback(async (text, type) => {
    const success = await copyToClipboard(text);
    showCopyNotification(success, type);
  }, []);

  // 查找Markdown源码中对应的部分
  const findMarkdownSource = useCallback((text, elementType = 'paragraph', headingLevel = 0) => {
    // 如果没有文本或内容，直接返回空字符串
    if (!text || !content) return '';
    
    console.log(`查找Markdown源码，文本类型:${elementType}, 级别:${headingLevel}, 文本:`, text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    
    // 清理文本，移除[object Object]占位符和多余空格
    const cleanedText = text.replace(/\[object Object\]/g, '').trim();
    
    // 如果文本太短，直接返回
    if (cleanedText.length < 3) {
      return text;
    }
    
    // 处理数学公式
    if (elementType === 'math' || elementType === 'inlineMath') {
      // 先检查文本是否就是公式
      // 移除公式符号$，获取纯公式内容
      const formula = text.replace(/^\$+|\$+$/g, '').trim();
      
      // 尝试在源代码中找到此公式
      const formulaPattern = new RegExp(`\\$\\$?${formula.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")}\\$\\$?`, 'g');
      const match = content.match(formulaPattern);
      
      if (match) {
        // 找到了完整的公式
        return formula;
      }
      
      // 如果没有找到精确匹配，尝试模糊匹配公式
      const contentLines = content.split('\n');
      let bestMatch = null;
      let bestSimilarity = 0;
      
      // 提取所有公式
      const formulaRegex = /\$\$?(.*?)\$\$?/g;
      let allFormulas = [];
      let m;
      
      while ((m = formulaRegex.exec(content)) !== null) {
        allFormulas.push(m[1].trim());
      }
      
      // 查找最匹配的公式
      for (const f of allFormulas) {
        const similarity = calculateSimilarity(formula, f);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = f;
        }
      }
      
      if (bestMatch && bestSimilarity > 0.6) {
        console.log(`找到最佳匹配公式，相似度: ${bestSimilarity}`);
        return bestMatch;
      }
      
      // 如果都找不到，返回原始公式
      return formula;
    }
    
    // 处理标题匹配
    if (elementType === 'heading') {
      // 为标题构建正则表达式模式
      const headingMarker = '#'.repeat(headingLevel);
      const headingPattern = new RegExp(`^${headingMarker}\\s+(.+?)$`, 'm');
      
      // 将内容分割成行
      const contentLines = content.split('\n');
      
      // 查找匹配的标题行
      for (const line of contentLines) {
        const match = line.match(headingPattern);
        if (match) {
          const headingText = match[1].trim();
          
          // 计算相似度 - 对于标题使用更严格的相似度计算
          const similarity = calculateSimilarity(cleanedText, headingText);
          if (similarity > 0.75) { // 标题需要更高的相似度阈值
            console.log(`找到匹配的标题: ${line}, 相似度: ${similarity}`);
            return match[1];
          }
        }
      }
      
      // 如果找不到精确匹配，尝试模糊匹配
      let bestMatch = null;
      let bestSimilarity = 0;
      
      for (const line of contentLines) {
        if (line.startsWith('#')) {
          const titleText = line.replace(/^#+\s+/, '').trim();
          const similarity = calculateSimilarity(cleanedText, titleText);
          
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = line;
          }
        }
      }
      
      if (bestMatch && bestSimilarity > 0.5) {
        console.log(`找到最佳匹配标题: ${bestMatch}, 相似度: ${bestSimilarity}`);
        return bestMatch.replace(/^#+\s+/, '');
      }
      
      // 如果还是找不到，返回清理后的文本
      return cleanedText;
    }
    
    // 检查是否是列表项
    const isListItem = (text) => {
      // 检查文本是否以列表标记开头
      return /^[\s]*[-*]\s/.test(text) || /^[\s]*\d+[\.\)]\s/.test(text);
    };
    
    // 如果是列表项，尝试在原始内容中找到匹配的列表项
    if (elementType === 'listItem' || isListItem(text)) {
      // 查找可能的列表项标记和文本
      const listItemMatch = text.match(/^[\s]*([-*]|\d+[\.\)])\s+(.*)/);
      
      if (listItemMatch) {
        const marker = listItemMatch[1]; // 列表标记（-、*、1.、1) 等）
        const itemText = listItemMatch[2].trim(); // 列表项文本
        
        // 在原始内容中查找匹配的列表项
        const contentLines = content.split('\n');
        let bestMatch = null;
        let bestSimilarity = 0;
        
        for (const line of contentLines) {
          const lineMatch = line.match(/^[\s]*([-*]|\d+[\.\)])\s+(.*)/);
          
          if (lineMatch) {
            const lineMarker = lineMatch[1];
            const lineItemText = lineMatch[2].trim();
            
            // 计算相似度
            const similarity = calculateSimilarity(itemText, lineItemText);
            
            if (similarity > bestSimilarity) {
              bestSimilarity = similarity;
              bestMatch = line;
            }
          }
        }
        
        if (bestMatch && bestSimilarity > 0.6) {
          console.log(`找到匹配的列表项: ${bestMatch}, 相似度: ${bestSimilarity}`);
          return bestMatch;
        }
      }
    }
    
    // 处理普通段落和其他内容
    // 将内容分割成段落
    const contentParagraphs = splitIntoParagraphs(content);
    
    // 提取文本中的关键词（去除常见的停用词）
    const stopWords = ['的', '了', '和', '是', '在', '有', '与', '这', '那', '为', '以', '及', '或', '等', 'the', 'a', 'an', 'and', 'or', 'is', 'are', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of'];
    const getKeywords = (text) => {
      return text.split(/\s+/)
        .filter(word => word.length > 1 && !stopWords.includes(word.toLowerCase()))
        .map(word => word.toLowerCase());
    };
    
    const textKeywords = getKeywords(cleanedText);
    
    if (textKeywords.length === 0) {
      // 如果没有关键词，直接返回清理后的文本
      return cleanedText;
    }
    
    // 查找最佳匹配段落
    let bestMatch = null;
    let bestSimilarity = 0;
    let bestMatchRatio = 0;
    
    for (const paragraph of contentParagraphs) {
      // 跳过太短的段落
      if (paragraph.trim().length < 10) continue;
      
      // 计算相似度
      const similarity = calculateSimilarity(cleanedText, paragraph);
      
      // 计算相对相似度比率（考虑段落长度）
      const paragraphLength = paragraph.length;
      const textLength = cleanedText.length;
      const lengthRatio = Math.min(paragraphLength, textLength) / Math.max(paragraphLength, textLength);
      const matchRatio = similarity * (0.5 + 0.5 * lengthRatio); // 结合相似度和长度比率
      
      if (matchRatio > bestMatchRatio) {
        bestMatchRatio = matchRatio;
        bestSimilarity = similarity;
        bestMatch = paragraph;
      }
    }
    
    // 如果找到了足够好的匹配
    if (bestMatch && bestSimilarity > 0.5) {
      console.log(`找到最佳匹配段落，相似度: ${bestSimilarity}, 匹配比率: ${bestMatchRatio}`);
      return bestMatch;
    }
    
    // 如果没有找到足够好的匹配，尝试基于关键词匹配
    bestMatch = null;
    let bestKeywordCount = 0;
    
    for (const paragraph of contentParagraphs) {
      const paragraphKeywords = getKeywords(paragraph);
      let keywordMatches = 0;
      
      for (const keyword of textKeywords) {
        if (paragraphKeywords.includes(keyword)) {
          keywordMatches++;
        }
      }
      
      // 计算关键词匹配率
      const keywordMatchRate = keywordMatches / textKeywords.length;
      
      if (keywordMatchRate > bestKeywordCount) {
        bestKeywordCount = keywordMatchRate;
        bestMatch = paragraph;
      }
    }
    
    // 如果找到了基于关键词的匹配
    if (bestMatch && bestKeywordCount > 0.5) {
      console.log(`通过关键词找到匹配，匹配率: ${bestKeywordCount}`);
      return bestMatch;
    }
    
    // 最后的回退方案：返回清理后的文本
    return cleanedText;
  }, [content]);
  
  // 辅助函数：计算两个字符串之间的相似度（0-1之间的值）
  const calculateSimilarity = useCallback((str1, str2) => {
    if (!str1 || !str2) return 0;
    
    // 转换为小写并去除多余空格
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // 如果有一个是空字符串，返回0
    if (s1.length === 0 || s2.length === 0) return 0;
    
    // 如果字符串完全相同，返回1
    if (s1 === s2) return 1;
    
    // 计算编辑距离
    const levDistance = levenshteinDistance(s1, s2);
    
    // 计算相似度
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = 1 - (levDistance / maxLength);
    
    return similarity;
  }, []);
  
  // 计算Levenshtein距离的辅助函数
  const levenshteinDistance = useCallback((str1, str2) => {
    const m = str1.length;
    const n = str2.length;
    
    // 创建距离矩阵
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
    
    // 初始化第一行和第一列
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    // 填充矩阵
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,       // 删除
          dp[i][j - 1] + 1,       // 插入
          dp[i - 1][j - 1] + cost // 替换
        );
      }
    }
    
    return dp[m][n];
  }, []);
  
  // 辅助函数：将内容分割成段落
  const splitIntoParagraphs = useCallback((text) => {
    if (!text) return [];
    
    const contentLines = text.split('\n');
    const paragraphs = [];
    let currentParagraph = [];
    let inList = false;
    let currentList = [];
    let inCodeBlock = false;
    
    // 将原始内容分割成段落，同时处理列表和代码块
    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i];
      const trimmedLine = line.trim();
      
      // 检查是否是代码块
      if (trimmedLine.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        
        // 如果有待处理的段落，先处理
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join('\n'));
          currentParagraph = [];
        }
        
        // 如果有待处理的列表，先处理
        if (inList && currentList.length > 0) {
          paragraphs.push(currentList.join('\n'));
          currentList = [];
          inList = false;
        }
        
        // 添加代码块标记行
        currentParagraph.push(line);
        
        // 如果结束了代码块，添加到段落中
        if (!inCodeBlock && currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join('\n'));
          currentParagraph = [];
        }
        
        continue;
      }
      
      // 在代码块内，所有行直接添加到当前段落
      if (inCodeBlock) {
        currentParagraph.push(line);
        continue;
      }
      
      // 检查是否是标题行
      if (trimmedLine.startsWith('#')) {
        // 如果有待处理的段落，先处理
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join('\n'));
          currentParagraph = [];
        }
        
        // 如果有待处理的列表，先处理
        if (inList && currentList.length > 0) {
          paragraphs.push(currentList.join('\n'));
          currentList = [];
          inList = false;
        }
        
        // 添加标题行作为单独的段落
        paragraphs.push(line);
        continue;
      }
      
      // 检查是否是列表项
      const isListLine = /^[\s]*[-*]\s/.test(line) || /^[\s]*\d+[\.\)]\s/.test(line);
      
      if (trimmedLine === '') {
        // 空行表示段落或列表结束
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join('\n'));
          currentParagraph = [];
        }
        
        if (inList && currentList.length > 0) {
          paragraphs.push(currentList.join('\n'));
          currentList = [];
          inList = false;
        }
      } else if (isListLine) {
        // 如果是列表项
        if (!inList) {
          // 如果之前不是列表，开始新列表
          if (currentParagraph.length > 0) {
            paragraphs.push(currentParagraph.join('\n'));
            currentParagraph = [];
          }
          inList = true;
        }
        
        currentList.push(line);
          } else {
        // 普通段落
        if (inList && currentList.length > 0) {
          paragraphs.push(currentList.join('\n'));
          currentList = [];
          inList = false;
        }
        
        currentParagraph.push(line);
      }
    }
    
    // 添加最后一个段落或列表
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join('\n'));
    }
    
    if (inList && currentList.length > 0) {
      paragraphs.push(currentList.join('\n'));
    }
    
    return paragraphs;
  }, []);

  // 复制按钮组件
  const CopyButtons = useCallback(({ plainText, markdownText, parentElement, elementType = 'paragraph', headingLevel = 0 }) => {
    // 创建一个引用，用于存储实际要复制的文本
    const textRef = useRef({ plainText, markdownText, elementType, headingLevel });
    const buttonRef = useRef(null);
    
    // 当props更新时更新引用
    useEffect(() => {
      textRef.current = { plainText, markdownText, elementType, headingLevel };
    }, [plainText, markdownText, elementType, headingLevel]);
    
    // 获取纯文本内容（不包含按钮文本）
    const getPureTextContent = useCallback((element) => {
      if (!element) return '';
      
      // 创建一个临时的克隆元素
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = element.innerHTML;
      
      // 移除所有复制按钮
      const buttons = tempDiv.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
      buttons.forEach(button => button.remove());
      
      // 获取纯文本内容
      return tempDiv.textContent;
    }, []);
    
    // 处理复制文本
    const handleCopyText = useCallback((e) => {
      e.stopPropagation();
      
      // 如果有父元素，尝试获取纯文本内容
      if (parentElement && parentElement.current) {
        const element = parentElement.current;
        
        // 创建一个临时的克隆元素
        const clonedElement = element.cloneNode(true);
        document.body.appendChild(clonedElement);
        clonedElement.style.position = 'absolute';
        clonedElement.style.left = '-9999px';
        
        // 从克隆元素中移除所有复制按钮
        const clonedButtons = clonedElement.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
        clonedButtons.forEach(button => button.remove());
        
        // 获取文本元素
        const textElement = clonedElement.querySelector('p, h1, h2, h3, h4, h5, h6');
        let pureText = '';
        
        if (textElement) {
          // 获取纯文本内容
          pureText = textElement.textContent;
        } else {
          // 如果找不到特定的文本元素，获取整个元素的文本内容
          pureText = clonedElement.textContent;
        }
        
        // 处理行内公式
        const inlineMathElements = element.querySelectorAll('.inline-math');
        if (inlineMathElements.length > 0) {
          let objectPlaceholderCount = 0;
          inlineMathElements.forEach((el) => {
            const formula = el.getAttribute('data-formula');
            if (formula) {
              // 查找下一个[object Object]并替换
              const placeholder = '[object Object]';
              const placeholderIndex = pureText.indexOf(placeholder, objectPlaceholderCount);
              
              if (placeholderIndex !== -1) {
                pureText = 
                  pureText.substring(0, placeholderIndex) + 
                  formula + 
                  pureText.substring(placeholderIndex + placeholder.length);
                
                // 更新搜索起始位置
                objectPlaceholderCount = placeholderIndex + formula.length;
              }
            }
          });
        }
        
        // 清理克隆元素
        document.body.removeChild(clonedElement);
        
        // 移除多余的空格和换行
        pureText = pureText.replace(/\s+/g, ' ').trim();
        
        console.log('复制纯文本:', pureText);
        handleCopy(pureText, '网页文字');
      } else {
        // 回退到传入的文本
        handleCopy(textRef.current.plainText, '网页文字');
      }
    }, [parentElement, handleCopy, getPureTextContent]);
    
    // 处理复制Markdown源码
    const handleCopyMarkdown = useCallback((e) => {
      e.stopPropagation();
      
      // 如果有父元素，尝试获取纯文本内容并查找对应的Markdown源码
      if (parentElement && parentElement.current) {
        const element = parentElement.current;
        
        // 临时隐藏所有复制按钮
        const allButtons = document.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
        const originalDisplayStyles = [];
        
        // 保存原始显示状态并隐藏按钮
        allButtons.forEach(button => {
          originalDisplayStyles.push(button.style.display);
          button.style.display = 'none';
        });
        
        // 创建一个临时的克隆元素
        const clonedElement = element.cloneNode(true);
        document.body.appendChild(clonedElement);
        clonedElement.style.position = 'absolute';
        clonedElement.style.left = '-9999px';
        
        // 从克隆元素中移除所有复制按钮
        const clonedButtons = clonedElement.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
        clonedButtons.forEach(button => button.remove());
        
        // 获取文本元素 - 根据元素类型选择合适的选择器
        let selector = 'p, h1, h2, h3, h4, h5, h6';
        if (textRef.current.elementType === 'heading') {
          // 对于标题，只选择相应的标题元素
          selector = `h${textRef.current.headingLevel}`;
        } else if (textRef.current.elementType === 'listItem') {
          // 对于列表项，不需要特殊处理
          selector = '*';
        }
        
        const textElement = clonedElement.querySelector(selector);
        let pureText = '';
        
        if (textElement) {
          // 获取纯文本内容
          pureText = textElement.textContent;
        } else {
          // 如果找不到特定的文本元素，获取整个元素的文本内容
          pureText = clonedElement.textContent;
        }
        
        // 清理克隆元素
        document.body.removeChild(clonedElement);
        
        // 恢复按钮显示状态
        allButtons.forEach((button, index) => {
          if (index < originalDisplayStyles.length) {
            button.style.display = originalDisplayStyles[index];
          }
        });
        
        // 根据元素类型和纯文本内容查找Markdown源码
        const markdownSource = findMarkdownSource(pureText, textRef.current.elementType, textRef.current.headingLevel);
        
        console.log('复制Markdown源码:', {
          pureText,
          elementType: textRef.current.elementType, 
          headingLevel: textRef.current.headingLevel,
          markdownSource
        });
        
        // 根据元素类型格式化最终的Markdown文本
        let finalMarkdown = markdownSource;
        
        if (textRef.current.elementType === 'heading') {
          // 如果是标题，添加#号
          const headingMarker = '#'.repeat(textRef.current.headingLevel);
          // 检查markdownSource是否已经包含标题标记
          if (!markdownSource.startsWith('#')) {
            finalMarkdown = `${headingMarker} ${markdownSource}`;
              } else {
            finalMarkdown = markdownSource;
          }
        } else if (textRef.current.elementType === 'listItem') {
          // 如果是列表项，检查是否已经包含列表标记
          if (!finalMarkdown.match(/^[\s]*([-*]|\d+[\.\)])\s+/)) {
            // 添加列表标记（默认为无序列表）
            finalMarkdown = `- ${finalMarkdown}`;
          }
        }
        
        // 复制格式化后的Markdown
        handleCopy(finalMarkdown, 'Markdown源码');
      } else {
        // 回退到传入的Markdown文本
        handleCopy(textRef.current.markdownText, 'Markdown源码');
      }
    }, [parentElement, handleCopy, findMarkdownSource, getPureTextContent]);
    
    return (
      <div className="copy-buttons" ref={buttonRef}>
        <button 
          className="copy-button"
          onClick={handleCopyText}
          title="复制网页文字"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '0.75rem', height: '0.75rem' }}>
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
          <span>复制文字</span>
        </button>
        <button 
          className="copy-button"
          onClick={handleCopyMarkdown}
          title="复制Markdown源码"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '0.75rem', height: '0.75rem' }}>
            <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          <span>复制源码</span>
        </button>
      </div>
    );
  }, [handleCopy, findMarkdownSource]);

  // 添加样式到head
  useEffect(() => {
    // 确保样式已加载
    const checkStylesLoaded = () => {
      const testElement = document.createElement('div');
      testElement.className = 'copy-buttons';
      document.body.appendChild(testElement);
      const styles = window.getComputedStyle(testElement);
      const isStyleLoaded = styles.position === 'absolute';
      document.body.removeChild(testElement);
      return isStyleLoaded;
    };

    if (!checkStylesLoaded()) {
      // 如果样式未加载，添加内联样式
      const style = document.createElement('style');
      style.textContent = `
        .copy-section {
          position: relative;
        }
        .copy-section:hover .copy-buttons {
          opacity: 1 !important;
          visibility: visible !important;
        }
        .paragraph-wrapper {
          position: relative;
          transition: background-color 0.2s;
        }
        .paragraph-wrapper:hover {
          background-color: #f9fafb;
        }
        .math-wrapper {
          position: relative;
        }
        .math-wrapper:hover .copy-buttons {
          opacity: 1 !important;
          visibility: visible !important;
        }
        .copy-buttons {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          display: flex;
          gap: 0.5rem;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s;
          z-index: 10;
          background-color: rgba(255, 255, 255, 0.9);
          padding: 0.25rem;
          border-radius: 0.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          /* 确保复制按钮不会被选中和复制 */
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          pointer-events: auto !important;
        }
        .copy-button {
          background-color: #f3f4f6;
          color: #374151;
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          /* 确保复制按钮不会被选中和复制 */
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
        }
        .copy-button:hover {
          background-color: #e5e7eb;
        }
        /* 确保复制按钮内的所有元素都不会被选中和复制 */
        .copy-button *, .copy-buttons * {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
        }
        /* KaTeX 公式容器样式调整 */
        .katex-display {
          position: relative !important;
          overflow: visible !important;
        }
        /* 确保公式复制按钮在悬停时可见 */
        .katex-display:hover + .copy-buttons {
          opacity: 1 !important;
          visibility: visible !important;
        }
        /* 新增：确保$$公式的复制按钮可见 */
        .katex-display:hover ~ .copy-buttons,
        .katex-html:hover ~ .copy-buttons {
          opacity: 1 !important;
          visibility: visible !important;
        }
        /* 新增：调整公式容器的边距 */
        .katex-display {
          margin-top: 1rem !important;
          margin-bottom: 1rem !important;
        }
        /* 新增：确保公式容器内的复制按钮正确定位 */
        .math-wrapper > .copy-buttons {
          position: absolute !important;
          top: 0.5rem !important;
          right: 0.5rem !important;
          z-index: 1000 !important;
        }
        /* 新增：确保公式容器的父元素可以正确显示复制按钮 */
        .katex-display-wrapper {
          position: relative !important;
          overflow: visible !important;
        }
        /* 新增：调整图片容器样式 */
        img {
          max-width: 100% !important;
          height: auto !important;
          margin: 1rem 0 !important;
        }
        /* 新增：行内公式样式 */
        .inline-math {
          display: inline-flex !important;
          align-items: center !important;
          background-color: rgba(0, 0, 0, 0.02) !important;
          border-radius: 0.25rem !important;
          padding: 0 0.25rem !important;
          margin: 0 0.25rem !important;
          position: relative !important;
        }
        .inline-math:hover {
          background-color: rgba(0, 0, 0, 0.05) !important;
        }
        /* 确保行内公式在段落中正确显示 */
        .paragraph-wrapper .inline-math {
          vertical-align: middle !important;
        }
        /* 确保行内公式的复制按钮在悬停时可见 */
        .inline-math:hover > div {
          opacity: 1 !important;
          visibility: visible !important;
        }
        /* 确保复制按钮的文本不会被选中和复制 */
        .copy-buttons span, .copy-buttons svg {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
        }
        /* 新增：行内公式复制按钮样式 */
        .inline-math-copy-buttons {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          pointer-events: auto !important;
        }
        /* 新增：列表项样式 */
        .list-item-wrapper {
          position: relative !important;
          padding-right: 2.5rem !important;
        }
        .list-item-wrapper:hover {
          background-color: #f9fafb !important;
        }
        .list-item-wrapper:hover > div {
          opacity: 1 !important;
          visibility: visible !important;
        }
        /* 调整列表样式 */
        ol, ul {
          padding-left: 1.5rem !important;
        }
        /* 确保有序列表和无序列表能够正确显示 */
        .copy-section ol, .copy-section ul {
          width: 100% !important;
        }
      `;
      document.head.appendChild(style);
      return () => {
        document.head.removeChild(style);
      };
    }
    return () => {};
  }, []);

  // 添加一个新的useEffect来处理KaTeX渲染后的公式
  useEffect(() => {
    if (!isEditing) {
      // 等待KaTeX渲染完成
      setTimeout(() => {
        console.log('开始处理KaTeX公式...');
        
        // 查找所有KaTeX渲染的块级公式
        const katexDisplays = document.querySelectorAll('.katex-display');
        console.log(`找到 ${katexDisplays.length} 个 .katex-display 元素`);
        
        // 也查找所有包含$$的元素（另一种方式查找块级公式）
        const mathElements = document.querySelectorAll('.math-wrapper');
        console.log(`找到 ${mathElements.length} 个 .math-wrapper 元素`);
        
        // 处理所有katex-display元素
        katexDisplays.forEach((display, index) => {
          console.log(`处理第 ${index + 1} 个 katex-display 元素`);
          
          // 检查是否已经添加了复制按钮
          if (!display.nextElementSibling?.classList.contains('copy-buttons')) {
            // 获取公式的TeX源码
            const texSource = display.querySelector('.katex-mathml annotation')?.textContent;
            console.log(`公式源码: ${texSource ? texSource.substring(0, 20) + '...' : '未找到'}`);
            
            if (texSource) {
              // 创建复制按钮容器
              const copyButtonsContainer = document.createElement('div');
              copyButtonsContainer.className = 'copy-buttons';
              copyButtonsContainer.style.position = 'absolute';
              copyButtonsContainer.style.top = '0.5rem';
              copyButtonsContainer.style.right = '0.5rem';
              copyButtonsContainer.style.zIndex = '1000';
              copyButtonsContainer.style.opacity = '0';
              copyButtonsContainer.style.visibility = 'hidden';
              
              // 确保复制按钮不会被选中和复制
              copyButtonsContainer.style.userSelect = 'none';
              copyButtonsContainer.style.WebkitUserSelect = 'none';
              copyButtonsContainer.style.MozUserSelect = 'none';
              copyButtonsContainer.style.msUserSelect = 'none';
              copyButtonsContainer.style.pointerEvents = 'auto';
              
              // 创建复制文字按钮
              const copyTextButton = document.createElement('button');
              copyTextButton.className = 'copy-button';
              copyTextButton.title = '复制公式文字';
              copyTextButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 0.75rem; height: 0.75rem;">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
                <span>复制文字</span>
              `;
              
              // 确保按钮不会被选中和复制
              copyTextButton.style.userSelect = 'none';
              copyTextButton.style.WebkitUserSelect = 'none';
              copyTextButton.style.MozUserSelect = 'none';
              copyTextButton.style.msUserSelect = 'none';
              
              copyTextButton.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // 临时隐藏所有复制按钮，以便获取纯文本内容
                const allButtons = document.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
                const originalDisplayStyles = [];
                
                // 保存原始显示状态并隐藏按钮
                allButtons.forEach(button => {
                  originalDisplayStyles.push(button.style.display);
                  button.style.display = 'none';
                });
                
                // 获取最新的公式文本
                const formula = texSource;
                
                // 恢复按钮显示状态
                allButtons.forEach((button, index) => {
                  if (index < originalDisplayStyles.length) {
                    button.style.display = originalDisplayStyles[index];
                  }
                });
                
                handleCopy(formula, '公式文字');
              });
              
              // 创建复制源码按钮
              const copySourceButton = document.createElement('button');
              copySourceButton.className = 'copy-button';
              copySourceButton.title = '复制公式源码';
              copySourceButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 0.75rem; height: 0.75rem;">
                  <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>复制源码</span>
              `;
              
              // 确保按钮不会被选中和复制
              copySourceButton.style.userSelect = 'none';
              copySourceButton.style.WebkitUserSelect = 'none';
              copySourceButton.style.MozUserSelect = 'none';
              copySourceButton.style.msUserSelect = 'none';
              
              copySourceButton.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // 临时隐藏所有复制按钮，以便获取纯文本内容
                const allButtons = document.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
                const originalDisplayStyles = [];
                
                // 保存原始显示状态并隐藏按钮
                allButtons.forEach(button => {
                  originalDisplayStyles.push(button.style.display);
                  button.style.display = 'none';
                });
                
                // 获取最新的公式文本
                const formula = texSource;
                
                // 恢复按钮显示状态
                allButtons.forEach((button, index) => {
                  if (index < originalDisplayStyles.length) {
                    button.style.display = originalDisplayStyles[index];
                  }
                });
                
                handleCopy(`$$${formula}$$`, '公式源码');
              });
              
              // 添加按钮到容器
              copyButtonsContainer.appendChild(copyTextButton);
              copyButtonsContainer.appendChild(copySourceButton);
              
              // 设置容器样式
              copyButtonsContainer.style.display = 'flex';
              copyButtonsContainer.style.gap = '0.5rem';
              copyButtonsContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
              copyButtonsContainer.style.padding = '0.25rem';
              copyButtonsContainer.style.borderRadius = '0.25rem';
              copyButtonsContainer.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              
              // 将容器添加到公式后面
              display.parentNode.insertBefore(copyButtonsContainer, display.nextSibling);
              
              // 确保父元素有相对定位
              if (window.getComputedStyle(display.parentNode).position === 'static') {
                display.parentNode.style.position = 'relative';
              }
              
              // 添加悬停事件
              display.parentNode.addEventListener('mouseenter', () => {
                copyButtonsContainer.style.opacity = '1';
                copyButtonsContainer.style.visibility = 'visible';
              });
              
              display.parentNode.addEventListener('mouseleave', () => {
                copyButtonsContainer.style.opacity = '0';
                copyButtonsContainer.style.visibility = 'hidden';
              });
            }
          }
        });
        
        // 处理所有math-wrapper元素（可能包含$$公式）
        mathElements.forEach((mathWrapper, index) => {
          console.log(`处理第 ${index + 1} 个 math-wrapper 元素`);
          
          // 检查是否已经有复制按钮
          const existingButtons = mathWrapper.querySelector('.copy-buttons');
          if (existingButtons) {
            console.log('该元素已有复制按钮');
            
            // 确保按钮可见性正确
            mathWrapper.addEventListener('mouseenter', () => {
              existingButtons.style.opacity = '1';
              existingButtons.style.visibility = 'visible';
            });
            
            mathWrapper.addEventListener('mouseleave', () => {
              existingButtons.style.opacity = '0';
              existingButtons.style.visibility = 'hidden';
            });
            
            return;
          }
          
          // 查找内部的katex-display元素
          const innerKatexDisplay = mathWrapper.querySelector('.katex-display');
          if (innerKatexDisplay) {
            console.log('找到内部的katex-display元素');
            
            // 获取公式源码
            const texSource = innerKatexDisplay.querySelector('.katex-mathml annotation')?.textContent;
            console.log(`公式源码: ${texSource ? texSource.substring(0, 20) + '...' : '未找到'}`);
            
            if (texSource) {
              // 创建复制按钮
              const copyButtons = document.createElement('div');
              copyButtons.className = 'copy-buttons';
              copyButtons.style.position = 'absolute';
              copyButtons.style.top = '0.5rem';
              copyButtons.style.right = '0.5rem';
              copyButtons.style.zIndex = '1000';
              copyButtons.style.display = 'flex';
              copyButtons.style.gap = '0.5rem';
              copyButtons.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
              copyButtons.style.padding = '0.25rem';
              copyButtons.style.borderRadius = '0.25rem';
              copyButtons.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              copyButtons.style.opacity = '0';
              copyButtons.style.visibility = 'hidden';
              
              // 确保复制按钮不会被选中和复制
              copyButtons.style.userSelect = 'none';
              copyButtons.style.WebkitUserSelect = 'none';
              copyButtons.style.MozUserSelect = 'none';
              copyButtons.style.msUserSelect = 'none';
              copyButtons.style.pointerEvents = 'auto';
              
              // 创建复制文字按钮
              const copyTextButton = document.createElement('button');
              copyTextButton.className = 'copy-button';
              copyTextButton.title = '复制公式文字';
              copyTextButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 0.75rem; height: 0.75rem;">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
                <span>复制文字</span>
              `;
              
              // 确保按钮不会被选中和复制
              copyTextButton.style.userSelect = 'none';
              copyTextButton.style.WebkitUserSelect = 'none';
              copyTextButton.style.MozUserSelect = 'none';
              copyTextButton.style.msUserSelect = 'none';
              
              copyTextButton.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // 临时隐藏所有复制按钮，以便获取纯文本内容
                const allButtons = document.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
                const originalDisplayStyles = [];
                
                // 保存原始显示状态并隐藏按钮
                allButtons.forEach(button => {
                  originalDisplayStyles.push(button.style.display);
                  button.style.display = 'none';
                });
                
                // 获取最新的公式文本
                const formula = texSource;
                
                // 恢复按钮显示状态
                allButtons.forEach((button, index) => {
                  if (index < originalDisplayStyles.length) {
                    button.style.display = originalDisplayStyles[index];
                  }
                });
                
                handleCopy(formula, '公式文字');
              });
              
              // 创建复制源码按钮
              const copySourceButton = document.createElement('button');
              copySourceButton.className = 'copy-button';
              copySourceButton.title = '复制公式源码';
              copySourceButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 0.75rem; height: 0.75rem;">
                  <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>复制源码</span>
              `;
              
              // 确保按钮不会被选中和复制
              copySourceButton.style.userSelect = 'none';
              copySourceButton.style.WebkitUserSelect = 'none';
              copySourceButton.style.MozUserSelect = 'none';
              copySourceButton.style.msUserSelect = 'none';
              
              copySourceButton.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // 临时隐藏所有复制按钮，以便获取纯文本内容
                const allButtons = document.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
                const originalDisplayStyles = [];
                
                // 保存原始显示状态并隐藏按钮
                allButtons.forEach(button => {
                  originalDisplayStyles.push(button.style.display);
                  button.style.display = 'none';
                });
                
                // 获取最新的公式文本
                const formula = texSource;
                
                // 恢复按钮显示状态
                allButtons.forEach((button, index) => {
                  if (index < originalDisplayStyles.length) {
                    button.style.display = originalDisplayStyles[index];
                  }
                });
                
                handleCopy(`$$${formula}$$`, '公式源码');
              });
              
              // 添加按钮到容器
              copyButtons.appendChild(copyTextButton);
              copyButtons.appendChild(copySourceButton);
              
              // 添加到math-wrapper
              mathWrapper.appendChild(copyButtons);
              
              // 确保math-wrapper有相对定位
              if (window.getComputedStyle(mathWrapper).position === 'static') {
                mathWrapper.style.position = 'relative';
              }
              
              // 添加悬停事件
              mathWrapper.addEventListener('mouseenter', () => {
                copyButtons.style.opacity = '1';
                copyButtons.style.visibility = 'visible';
              });
              
              mathWrapper.addEventListener('mouseleave', () => {
                copyButtons.style.opacity = '0';
                copyButtons.style.visibility = 'hidden';
              });
            }
          }
        });
      }, 500); // 给KaTeX一些时间来渲染
    }
  }, [isEditing, content, handleCopy]);

  // 添加一个新的useEffect来处理段落中的行内公式
  useEffect(() => {
    if (!isEditing) {
      // 等待KaTeX渲染完成
      setTimeout(() => {
        console.log('开始处理段落中的行内公式...');
        
        // 查找所有段落
        const paragraphs = document.querySelectorAll('.paragraph-wrapper');
        console.log(`找到 ${paragraphs.length} 个段落元素`);
        
        paragraphs.forEach((paragraph, index) => {
          // 查找段落中的所有行内公式
          const inlineMathElements = paragraph.querySelectorAll('.inline-math');
          
          if (inlineMathElements.length > 0) {
            console.log(`段落 ${index + 1} 包含 ${inlineMathElements.length} 个行内公式`);
            
            // 获取段落的复制按钮
            const copyButtons = paragraph.querySelector('.copy-buttons');
            
            if (copyButtons) {
              // 创建新的复制按钮
              const newCopyButtons = copyButtons.cloneNode(true);
              
              // 确保复制按钮不会被选中和复制
              newCopyButtons.style.userSelect = 'none';
              newCopyButtons.style.WebkitUserSelect = 'none';
              newCopyButtons.style.MozUserSelect = 'none';
              newCopyButtons.style.msUserSelect = 'none';
              newCopyButtons.style.pointerEvents = 'auto';
              
              // 获取所有行内公式的文本
              const formulaTexts = Array.from(inlineMathElements).map(el => {
                const formula = el.getAttribute('data-formula');
                return formula ? `$${formula}$` : '';
              });
              
              // 替换复制文字按钮的点击事件
              const copyTextButton = newCopyButtons.querySelector('button:first-child');
              if (copyTextButton) {
                // 确保按钮不会被选中和复制
                copyTextButton.style.userSelect = 'none';
                copyTextButton.style.WebkitUserSelect = 'none';
                copyTextButton.style.MozUserSelect = 'none';
                copyTextButton.style.msUserSelect = 'none';
                
                copyTextButton.addEventListener('click', (e) => {
                  e.stopPropagation();
                  
                  // 临时隐藏所有复制按钮，以便获取纯文本内容
                  const allCopyButtons = document.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
                  const originalDisplayStyles = [];
                  
                  // 保存原始显示状态并隐藏按钮
                  allCopyButtons.forEach(button => {
                    originalDisplayStyles.push(button.style.display);
                    button.style.display = 'none';
                  });
                  
                  // 创建一个临时的克隆元素
                  const clonedParagraph = paragraph.cloneNode(true);
                  document.body.appendChild(clonedParagraph);
                  clonedParagraph.style.position = 'absolute';
                  clonedParagraph.style.left = '-9999px';
                  
                  // 从克隆元素中移除所有复制按钮
                  const clonedButtons = clonedParagraph.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
                  clonedButtons.forEach(button => button.remove());
                  
                  // 获取段落的文本内容
                  const paragraphElement = clonedParagraph.querySelector('p, h1, h2, h3, h4, h5, h6');
                  let paragraphText = '';
                  
                  if (paragraphElement) {
                    // 获取段落的原始文本（现在不包含按钮文本）
                    paragraphText = paragraphElement.textContent;
                    
                    // 构建包含行内公式的文本
                    let textWithFormulas = paragraphText;
                    
                    // 替换[object Object]为实际的公式
                    let objectPlaceholderCount = 0;
                    inlineMathElements.forEach((el, i) => {
                      const formula = el.getAttribute('data-formula');
                      if (formula) {
                        // 查找下一个[object Object]并替换
                        const placeholder = '[object Object]';
                        const placeholderIndex = textWithFormulas.indexOf(placeholder, objectPlaceholderCount);
                        
                        if (placeholderIndex !== -1) {
                          textWithFormulas = 
                            textWithFormulas.substring(0, placeholderIndex) + 
                            formula + 
                            textWithFormulas.substring(placeholderIndex + placeholder.length);
                          
                          // 更新搜索起始位置
                          objectPlaceholderCount = placeholderIndex + formula.length;
                        }
                      }
                    });
                    
                    // 清理克隆元素
                    document.body.removeChild(clonedParagraph);
                    
                    // 恢复按钮显示状态
                    allCopyButtons.forEach((button, index) => {
                      if (index < originalDisplayStyles.length) {
                        button.style.display = originalDisplayStyles[index];
                      }
                    });
                    
                    console.log('复制段落文本:', textWithFormulas);
                    handleCopy(textWithFormulas, '网页文字');
                  }
                });
              }
              
              // 替换复制源码按钮的点击事件
              const copySourceButton = newCopyButtons.querySelector('button:last-child');
              if (copySourceButton) {
                // 确保按钮不会被选中和复制
                copySourceButton.style.userSelect = 'none';
                copySourceButton.style.WebkitUserSelect = 'none';
                copySourceButton.style.MozUserSelect = 'none';
                copySourceButton.style.msUserSelect = 'none';
                
                copySourceButton.addEventListener('click', (e) => {
                  e.stopPropagation();
                  
                  // 临时隐藏所有复制按钮，以便获取纯文本内容
                  const allCopyButtons = document.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
                  const originalDisplayStyles = [];
                  
                  // 保存原始显示状态并隐藏按钮
                  allCopyButtons.forEach(button => {
                    originalDisplayStyles.push(button.style.display);
                    button.style.display = 'none';
                  });
                  
                  // 创建一个临时的克隆元素
                  const clonedParagraph = paragraph.cloneNode(true);
                  document.body.appendChild(clonedParagraph);
                  clonedParagraph.style.position = 'absolute';
                  clonedParagraph.style.left = '-9999px';
                  
                  // 从克隆元素中移除所有复制按钮
                  const clonedButtons = clonedParagraph.querySelectorAll('.copy-buttons, .inline-math-copy-buttons, .copy-button');
                  clonedButtons.forEach(button => button.remove());
                  
                  // 获取段落的文本内容
                  const paragraphElement = clonedParagraph.querySelector('p, h1, h2, h3, h4, h5, h6');
                  let paragraphText = '';
                  
                  if (paragraphElement) {
                    // 获取段落的原始文本（现在不包含按钮文本）
                    paragraphText = paragraphElement.textContent;
                    
                    // 清理克隆元素
                    document.body.removeChild(clonedParagraph);
                    
                    // 恢复按钮显示状态
                    allCopyButtons.forEach((button, index) => {
                      if (index < originalDisplayStyles.length) {
                        button.style.display = originalDisplayStyles[index];
                      }
                    });
                    
                    // 获取原始的Markdown源码
                    let markdownSource = findMarkdownSource(paragraphText);
                    
                    // 替换[object Object]为实际的公式
                    let objectPlaceholderCount = 0;
                    inlineMathElements.forEach((el, i) => {
                      const formula = el.getAttribute('data-formula');
                      if (formula) {
                        // 查找下一个[object Object]并替换
                        const placeholder = '[object Object]';
                        const placeholderIndex = markdownSource.indexOf(placeholder, objectPlaceholderCount);
                        
                        if (placeholderIndex !== -1) {
                          markdownSource = 
                            markdownSource.substring(0, placeholderIndex) + 
                            `$${formula}$` + 
                            markdownSource.substring(placeholderIndex + placeholder.length);
                          
                          // 更新搜索起始位置
                          objectPlaceholderCount = placeholderIndex + formula.length + 2; // +2 for the $ signs
                        } else {
                          // 如果找不到[object Object]，尝试直接在源码中查找公式
                          const formulaRegex = new RegExp(`\\$([^$]*)\\$`, 'g');
                          const matches = [...markdownSource.matchAll(formulaRegex)];
                          
                          if (matches.length > i) {
                            // 替换第i+1个公式
                            const match = matches[i];
                            markdownSource = 
                              markdownSource.substring(0, match.index) + 
                              `$${formula}$` + 
                              markdownSource.substring(match.index + match[0].length);
                          }
                        }
                      }
                    });
                    
                    console.log('复制段落Markdown:', markdownSource);
                    handleCopy(markdownSource, 'Markdown源码');
                  }
                });
              }
              
              // 替换原始的复制按钮
              paragraph.replaceChild(newCopyButtons, copyButtons);
            }
          }
        });
      }, 800); // 给KaTeX和React渲染一些时间
    }
  }, [isEditing, content, handleCopy, findMarkdownSource]);

  // 添加一个新的useEffect，为每个段落添加唯一标识符
  useEffect(() => {
    if (!isEditing) {
      // 等待React渲染完成
      setTimeout(() => {
        console.log('为段落添加唯一标识符...');
        
        // 查找所有段落
        const paragraphs = document.querySelectorAll('.paragraph-wrapper');
        console.log(`找到 ${paragraphs.length} 个段落元素`);
        
        // 为每个段落添加唯一ID
        paragraphs.forEach((paragraph, index) => {
          // 生成唯一ID
          const paragraphId = `paragraph-${index}`;
          paragraph.setAttribute('id', paragraphId);
          paragraph.setAttribute('data-paragraph-index', index.toString());
          
          // 获取段落的文本内容
          const paragraphElement = paragraph.querySelector('p, h1, h2, h3, h4, h5, h6');
          if (paragraphElement) {
            const paragraphText = paragraphElement.textContent;
            // 存储段落文本的前20个字符作为标识
            const textIdentifier = paragraphText.substring(0, 20).replace(/\s+/g, ' ').trim();
            paragraph.setAttribute('data-text-identifier', textIdentifier);
            
            // 获取段落的复制按钮
            const copyButtons = paragraph.querySelector('.copy-buttons');
            if (copyButtons) {
              // 为复制按钮添加段落ID
              copyButtons.setAttribute('data-for-paragraph', paragraphId);
            }
          }
        });
      }, 500);
    }
  }, [isEditing, content]);

  useEffect(() => {
    setContent(initialContent);
    setOriginalContent(initialContent);
  }, [initialContent]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    setOriginalContent(content);
    if (onSave) {
      onSave(content);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setContent(originalContent);
  };

  // 处理编辑区域的滚动同步
  const handleEditorScroll = (e) => {
    if (!previewRef.current || !editorRef.current || isScrolling) return;
    
    setIsScrolling(true);
    
    const editorElement = editorRef.current;
    const previewElement = previewRef.current;
    
    // 获取编辑器中可见的第一行文本
    const editorScrollTop = editorElement.scrollTop;
    const lineHeight = 20; // 估计的行高
    const firstVisibleLineIndex = Math.floor(editorScrollTop / lineHeight);
    
    // 获取预览区域中的所有标题和段落元素
    const previewElements = previewElement.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, table');
    const previewElementsArray = Array.from(previewElements);
    
    if (previewElementsArray.length > 0) {
      // 尝试找到与编辑器中第一行可见文本对应的元素
      // 这里使用一个简单的启发式方法：按比例查找
      const targetIndex = Math.min(
        Math.floor(firstVisibleLineIndex * previewElementsArray.length / (content.split('\n').length || 1)),
        previewElementsArray.length - 1
      );
      
      if (targetIndex >= 0) {
        const targetElement = previewElementsArray[targetIndex];
        targetElement.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
    }
    
    setTimeout(() => setIsScrolling(false), 100);
  };

  // 处理预览区域的滚动同步
  const handlePreviewScroll = (e) => {
    if (!previewRef.current || !editorRef.current || isScrolling) return;
    
    setIsScrolling(true);
    
    const editorElement = editorRef.current;
    const previewElement = previewRef.current;
    
    // 获取预览区域中可见的第一个元素
    const previewScrollTop = previewElement.scrollTop;
    const previewElements = previewElement.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, table');
    const previewElementsArray = Array.from(previewElements);
    
    if (previewElementsArray.length > 0) {
      // 找到当前可见的第一个元素
      let firstVisibleElementIndex = 0;
      for (let i = 0; i < previewElementsArray.length; i++) {
        const element = previewElementsArray[i];
        if (element.offsetTop >= previewScrollTop) {
          firstVisibleElementIndex = i;
          break;
        }
      }
      
      // 计算对应的编辑器行
      const targetLine = Math.floor(
        firstVisibleElementIndex * (content.split('\n').length || 1) / previewElementsArray.length
      );
      
      // 滚动编辑器到对应行
      const lineHeight = 20; // 估计的行高
      editorElement.scrollTop = targetLine * lineHeight;
    }
    
    setTimeout(() => setIsScrolling(false), 100);
  };

  // 提取文本内容的辅助函数
  const extractTextContent = useCallback((children) => {
    // 如果是数组，递归处理每个元素并连接
    if (Array.isArray(children)) {
      return children.map(extractTextContent).join('');
    }
    
    // 如果是字符串，直接返回
    if (typeof children === 'string') {
      return children;
    }
    
    // 如果是React元素
    if (children && typeof children === 'object' && children.props) {
      // 检查是否有data-formula属性（行内公式）
      if (children.props['data-formula']) {
        return children.props['data-formula'];
      }
      
      // 检查是否有value属性（行内公式）
      if (children.props.value) {
        // 确保value是字符串
        const value = typeof children.props.value === 'object' ? 
          (children.props.value.props?.children || children.props.value.toString()) : 
          String(children.props.value);
        
        return value;
      }
      
      // 如果是行内公式组件
      if (children.type && children.type.name === 'inlineMath') {
        return children.props.value;
      }
      
      // 如果是KaTeX渲染的公式
      if (children.props.className && children.props.className.includes('katex')) {
        // 尝试从KaTeX的annotation元素中提取TeX源
        const annotationEl = children.props.children?.find?.(
          child => child?.props?.className === 'katex-html'
        );
        if (annotationEl) {
          return `$${annotationEl.props['data-formula'] || ''}$`;
        }
        
        // 如果找不到annotation，尝试从data-formula属性获取
        if (children.props['data-formula']) {
          return `$${children.props['data-formula']}$`;
        }
        
        return '$公式$'; // 默认占位符
      }
      
      // 递归处理子元素
      if (children.props.children) {
        return extractTextContent(children.props.children);
      }
    }
    
    // 如果是其他类型，尝试转换为字符串
    try {
      return String(children);
    } catch (e) {
      console.error('无法提取文本内容:', e);
      return '';
    }
  }, []);

  // 自定义组件来处理图片路径和添加复制功能
  const components = {
    // 自定义段落渲染，添加复制功能
    p: ({ children }) => {
      const plainText = extractTextContent(children);
      const paragraphRef = useRef(null);
      
      // 检查是否包含行内公式
      const hasInlineMath = typeof children === 'object' && 
                            (children.type === 'inlineMath' || 
                             (Array.isArray(children) && 
                              children.some(child => 
                                typeof child === 'object' && child && child.type === 'inlineMath')));
      
      // 如果是普通段落（不包含行内公式），添加复制按钮
      return (
        <div className="copy-section paragraph-wrapper" style={{ position: 'relative', padding: '0.5rem', margin: '0.5rem 0', borderRadius: '0.25rem' }} ref={paragraphRef}>
          <p className="text-base leading-relaxed">{children}</p>
          <CopyButtons 
            plainText={plainText} 
            markdownText={plainText} 
            parentElement={paragraphRef}
            elementType="paragraph"
          />
        </div>
      );
    },
    img: ({ src, alt }) => {
      // 如果是相对路径，添加basePath前缀
      let imgSrc = src;
      
      // 确保basePath存在且不为空
      if (basePath && !src.startsWith('http') && !src.startsWith('/')) {
        // 移除basePath开头和结尾的斜杠，确保路径格式正确
        const cleanBasePath = basePath.replace(/^\/|\/$/g, '');
        imgSrc = `/${cleanBasePath}/${src}`;
      } else if (!src.startsWith('http') && !src.startsWith('/')) {
        // 如果没有basePath但路径是相对路径，添加/前缀
        imgSrc = `/${src}`;
      }
      
      console.log('处理图片路径:', src, '转换为:', imgSrc, 'basePath:', basePath); // 添加调试日志
      return <img src={imgSrc} alt={alt || ''} className="max-w-full h-auto" loading="lazy" />;
    },
    // 自定义标题样式 - 减小字体大小
    h1: ({ children }) => {
      const plainText = extractTextContent(children);
      const headingRef = useRef(null);
      
      return (
        <div className="copy-section paragraph-wrapper" style={{ padding: '0.5rem', margin: '0.5rem 0', borderRadius: '0.25rem' }} ref={headingRef}>
          <h1 className="text-3xl font-bold my-5">{children}</h1>
          <CopyButtons 
            plainText={plainText} 
            markdownText={plainText} 
            parentElement={headingRef} 
            elementType="heading"
            headingLevel={1}
          />
        </div>
      );
    },
    h2: ({ children }) => {
      const plainText = extractTextContent(children);
      const headingRef = useRef(null);
      
      return (
        <div className="copy-section paragraph-wrapper" style={{ padding: '0.5rem', margin: '0.5rem 0', borderRadius: '0.25rem' }} ref={headingRef}>
          <h2 className="text-2xl font-bold my-4">{children}</h2>
          <CopyButtons 
            plainText={plainText} 
            markdownText={plainText} 
            parentElement={headingRef} 
            elementType="heading"
            headingLevel={2}
          />
        </div>
      );
    },
    h3: ({ children }) => {
      const plainText = extractTextContent(children);
      const headingRef = useRef(null);
      
      return (
        <div className="copy-section paragraph-wrapper" style={{ padding: '0.5rem', margin: '0.5rem 0', borderRadius: '0.25rem' }} ref={headingRef}>
          <h3 className="text-xl font-bold my-3">{children}</h3>
          <CopyButtons 
            plainText={plainText} 
            markdownText={plainText} 
            parentElement={headingRef} 
            elementType="heading"
            headingLevel={3}
          />
        </div>
      );
    },
    h4: ({ children }) => {
      const plainText = extractTextContent(children);
      const headingRef = useRef(null);
      
      return (
        <div className="copy-section paragraph-wrapper" style={{ padding: '0.5rem', margin: '0.5rem 0', borderRadius: '0.25rem' }} ref={headingRef}>
          <h4 className="text-lg font-bold my-2">{children}</h4>
          <CopyButtons 
            plainText={plainText} 
            markdownText={plainText} 
            parentElement={headingRef}
            elementType="heading"
            headingLevel={4}
          />
        </div>
      );
    },
    h5: ({ children }) => {
      const plainText = extractTextContent(children);
      const headingRef = useRef(null);
      
      return (
        <div className="copy-section paragraph-wrapper" style={{ padding: '0.5rem', margin: '0.5rem 0', borderRadius: '0.25rem' }} ref={headingRef}>
          <h5 className="text-base font-bold my-2">{children}</h5>
          <CopyButtons 
            plainText={plainText} 
            markdownText={plainText} 
            parentElement={headingRef}
            elementType="heading"
            headingLevel={5}
          />
        </div>
      );
    },
    h6: ({ children }) => {
      const plainText = extractTextContent(children);
      const headingRef = useRef(null);
      
      return (
        <div className="copy-section paragraph-wrapper" style={{ padding: '0.5rem', margin: '0.5rem 0', borderRadius: '0.25rem' }} ref={headingRef}>
          <h6 className="text-sm font-bold my-2">{children}</h6>
          <CopyButtons 
            plainText={plainText} 
            markdownText={plainText}
            parentElement={headingRef}
            elementType="heading"
            headingLevel={6}
          />
        </div>
      );
    },
    // 自定义表格样式
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full divide-y divide-gray-200 border">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-50">
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {children}
      </td>
    ),
    tr: ({ children }) => (
      <tr className="even:bg-gray-50">
        {children}
      </tr>
    ),
    // 自定义列表样式
    ul: ({ children }) => {
      // 使用新的提取文本内容的函数
      const plainText = extractTextContent(children);
      const markdownText = findMarkdownSource(plainText);
      const listRef = useRef(null);
      
      return (
        <div className="copy-section paragraph-wrapper" style={{ padding: '0.5rem', margin: '0.5rem 0', borderRadius: '0.25rem' }} ref={listRef}>
      <ul className="list-disc list-inside my-4 space-y-2">
        {children}
      </ul>
          <CopyButtons plainText={plainText} markdownText={markdownText} parentElement={listRef} />
        </div>
      );
    },
    ol: ({ children }) => {
      // 使用新的提取文本内容的函数
      const plainText = extractTextContent(children);
      const markdownText = findMarkdownSource(plainText);
      const listRef = useRef(null);
      
      return (
        <div className="copy-section paragraph-wrapper" style={{ padding: '0.5rem', margin: '0.5rem 0', borderRadius: '0.25rem' }} ref={listRef}>
      <ol className="list-decimal list-inside my-4 space-y-2">
        {children}
      </ol>
          <CopyButtons plainText={plainText} markdownText={markdownText} parentElement={listRef} />
        </div>
      );
    },
    // 自定义代码块样式
    code: ({ node, inline, className, children, ...props }) => {
      const codeText = children.toString();
      const codeRef = useRef(null);
      
      return inline ? (
      <code
          className={`${className} bg-gray-100 rounded px-1`}
        {...props}
      >
        {children}
      </code>
      ) : (
        <div className="copy-section" style={{ position: 'relative', margin: '1rem 0' }} ref={codeRef}>
          <pre className="block bg-gray-800 text-white p-4 rounded-lg overflow-x-auto">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
          <CopyButtons plainText={codeText} markdownText={`\`\`\`\n${codeText}\n\`\`\``} parentElement={codeRef} />
        </div>
      );
    },
    // 自定义数学公式渲染，添加复制功能
    math: ({ node, value, ...props }) => {
      console.log('渲染块级公式:', value); // 添加调试日志
      const mathRef = useRef(null);
      
      return (
        <div className="copy-section math-wrapper" 
          style={{ 
            position: 'relative', 
            padding: '0.5rem', 
            margin: '1rem 0', 
            borderRadius: '0.25rem',
            border: '1px solid rgba(0,0,0,0.05)',
            overflow: 'visible'
          }}
          ref={mathRef}
          data-formula={value}
        >
          <div className="katex-formula-container">
            <div {...props} />
          </div>
          <div style={{ 
            position: 'absolute', 
            top: '0.25rem', 
            right: '0.25rem', 
            transform: 'scale(0.8)',
            zIndex: 10
          }}>
            <CopyButtons 
              plainText={`$${value}$`} 
              markdownText={`$$${value}$$`} 
              parentElement={mathRef}
              elementType="math"
            />
          </div>
        </div>
      );
    },
    // 行内数学公式
    inlineMath: ({ node, value, ...props }) => {
      console.log('Inline math formula rendered:', value, props); // 添加调试日志
      const mathRef = useRef(null);
      
      // 确保value是字符串
      const formulaText = typeof value === 'object' ? 
        (value.props?.children || value.toString()) : 
        String(value);
      
      return (
        <span className="copy-section math-wrapper inline-math" 
          style={{ 
            position: 'relative', 
            display: 'inline-block', 
            padding: '0 0.25rem',
            margin: '0 0.25rem',
            borderRadius: '0.25rem'
          }} 
          data-formula={formulaText}
          ref={mathRef}
        >
          <span dangerouslySetInnerHTML={{ 
            __html: katex.renderToString(formulaText, { 
              throwOnError: false, 
              displayMode: false 
            }) 
          }} />
          <div className="inline-math-copy-buttons" style={{ 
            position: 'absolute', 
            top: '-1rem', 
            right: '-0.5rem', 
            transform: 'scale(0.65)',
            zIndex: 10,
            display: 'none'
          }}>
            <CopyButtons 
              plainText={formulaText} 
              markdownText={`$${formulaText}$`} 
              parentElement={mathRef}
              elementType="inlineMath"
            />
          </div>
        </span>
      );
    },
    // 自定义列表项渲染
    li: ({ node, ordered, checked, index, children, ...props }) => {
      // 检查是否需要保留原始格式
      const preserveFormat = node && 
                             node.properties && 
                             node.properties.preserveFormat;
      
      // 提取文本内容以便复制
      const itemText = extractTextContent(children);
      
      // 检查是否包含行内公式
      const hasInlineMath = typeof children === 'object' && 
                            (children.type === 'inlineMath' || 
                             (Array.isArray(children) && 
                              children.some(child => 
                                typeof child === 'object' && child && child.type === 'inlineMath')));
      
      // 判断是否在有序列表中
      const isInOrderedList = () => {
        // 查找父元素是否为有序列表
        if (node && node.parentNode && node.parentNode.tagName) {
          return node.parentNode.tagName.toLowerCase() === 'ol';
        }
        return false;
      };
      
      // 确定列表项的Markdown前缀 - 保留原始格式
      const getListItemPrefix = () => {
        // 如果是有序列表且需要保留原始格式
        if (isInOrderedList() && preserveFormat) {
          // 尝试从原始文本获取格式
          const originalText = node.originalText || '';
          const match = originalText.match(/^(\d+[\.\)])/);
          if (match) {
            return match[1] + ' ';
          }
          
        // 查找当前列表项在父列表中的索引
        if (node && node.parentNode && node.parentNode.children) {
          const index = Array.from(node.parentNode.children).indexOf(node);
            return `${index + 1}) `;  // 默认使用 n) 格式
          }
        }
        
        // 默认格式
        return ordered ? `${index + 1}. ` : '- ';
      };
      
      // 如果包含行内公式或需要特殊处理，添加复制按钮
      if (hasInlineMath) {
        const itemRef = useRef(null);
        const prefix = getListItemPrefix();
        
        return (
          <li className="copy-section list-item-wrapper" 
              style={{ 
                position: 'relative', 
                paddingRight: '2.5rem' 
              }} 
              ref={itemRef}
              {...props}>
            {children}
            <div style={{ 
              position: 'absolute', 
              top: '0.25rem', 
              right: '0.25rem',
              transform: 'scale(0.8)',
              zIndex: 10
            }}>
              <CopyButtons 
                plainText={itemText} 
                markdownText={`${prefix}${itemText}`} 
                parentElement={itemRef} 
                elementType="listItem"
              />
            </div>
          </li>
        );
      }
      
      // 普通列表项
      return <li {...props}>{children}</li>;
    },
  };

  return (
    <div className="relative">
      {/* 固定在左侧中间的编辑按钮 */}
      <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-20">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-lg"
            >
              保存
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 shadow-lg"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-lg"
          >
            编辑
          </button>
        )}
      </div>

      <div className="mt-4">
        {isEditing ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="relative h-[calc(100vh-200px)]">
              <textarea
                ref={editorRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onScroll={handleEditorScroll}
                className="w-full h-full p-4 border rounded dark:bg-gray-700 dark:text-white font-mono absolute inset-0 resize-none"
              />
            </div>
            <div className="relative h-[calc(100vh-200px)]">
              <div 
                ref={previewRef}
                onScroll={handlePreviewScroll}
                className="prose dark:prose-invert max-w-none overflow-auto h-full bg-white p-6 rounded-lg shadow absolute inset-0"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkPreserveListFormat, remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw]}
                  components={components}
                  className="markdown-preview"
                  transformImageUri={(src) => {
                    console.log('transformImageUri:', src, basePath);
                    
                    // 如果是相对路径，添加basePath前缀
                    let imgSrc = src;
                    
                    // 确保basePath存在且不为空
                    if (basePath && !src.startsWith('http') && !src.startsWith('/')) {
                      // 移除basePath开头和结尾的斜杠，确保路径格式正确
                      const cleanBasePath = basePath.replace(/^\/|\/$/g, '');
                      imgSrc = `/${cleanBasePath}/${src}`;
                    } else if (!src.startsWith('http') && !src.startsWith('/')) {
                      // 如果没有basePath但路径是相对路径，添加/前缀
                      imgSrc = `/${src}`;
                    }
                    
                    return imgSrc;
                  }}
                  remarkRehypeOptions={{ 
                    allowDangerousHtml: true,
                    // 添加配置以保留原始格式
                    clobberPrefix: '',
                    footnoteLabel: '脚注',
                    footnoteBackLabel: '返回',
                    // 自定义列表处理
                    listItem: {
                      useOriginalFormat: true
                    }
                  }}
                >
                  {preprocessMarkdown(content)}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className={`prose dark:prose-invert max-w-none bg-white p-6 rounded-lg shadow ${isFullScreen ? 'ml-16' : ''}`}>
            <ReactMarkdown
              remarkPlugins={[remarkPreserveListFormat, remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeRaw]}
              components={components}
              className="markdown-preview"
              transformImageUri={(src) => {
                console.log('transformImageUri:', src, basePath);
                
                // 如果是相对路径，添加basePath前缀
                let imgSrc = src;
                
                // 确保basePath存在且不为空
                if (basePath && !src.startsWith('http') && !src.startsWith('/')) {
                  // 移除basePath开头和结尾的斜杠，确保路径格式正确
                  const cleanBasePath = basePath.replace(/^\/|\/$/g, '');
                  imgSrc = `/${cleanBasePath}/${src}`;
                } else if (!src.startsWith('http') && !src.startsWith('/')) {
                  // 如果没有basePath但路径是相对路径，添加/前缀
                  imgSrc = `/${src}`;
                }
                
                return imgSrc;
              }}
              remarkRehypeOptions={{ 
                allowDangerousHtml: true,
                // 添加配置以保留原始格式
                clobberPrefix: '',
                footnoteLabel: '脚注',
                footnoteBackLabel: '返回',
                // 自定义列表处理
                listItem: {
                  useOriginalFormat: true
                }
              }}
            >
              {preprocessMarkdown(content)}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default CopyableEditableMarkdown; 