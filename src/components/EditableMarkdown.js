import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

const EditableMarkdown = ({ initialContent, onSave, basePath, isFullScreen }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [originalContent, setOriginalContent] = useState(initialContent);
  const editorRef = useRef(null);
  const previewRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);

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

  // 自定义组件来处理图片路径
  const components = {
    img: ({ src, alt }) => {
      // 如果是相对路径，添加basePath前缀
      const imgSrc = src.startsWith('http') ? src : `${basePath}/${src}`;
      return <img src={imgSrc} alt={alt} className="max-w-full h-auto" />;
    },
    // 自定义标题样式 - 减小字体大小
    h1: ({ children }) => <h1 className="text-3xl font-bold my-5">{children}</h1>,
    h2: ({ children }) => <h2 className="text-2xl font-bold my-4">{children}</h2>,
    h3: ({ children }) => <h3 className="text-xl font-bold my-3">{children}</h3>,
    h4: ({ children }) => <h4 className="text-lg font-bold my-2">{children}</h4>,
    h5: ({ children }) => <h5 className="text-base font-bold my-2">{children}</h5>,
    h6: ({ children }) => <h6 className="text-sm font-bold my-2">{children}</h6>,
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
    // 自定义段落样式
    p: ({ children }) => (
      <p className="text-base leading-relaxed my-4">
        {children}
      </p>
    ),
    // 自定义列表样式
    ul: ({ children }) => (
      <ul className="list-disc list-inside my-4 space-y-2">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside my-4 space-y-2">
        {children}
      </ol>
    ),
    // 自定义代码块样式
    code: ({ node, inline, className, children, ...props }) => (
      <code
        className={`${className} ${
          inline ? 'bg-gray-100 rounded px-1' : 'block bg-gray-800 text-white p-4 rounded-lg overflow-x-auto'
        }`}
        {...props}
      >
        {children}
      </code>
    ),
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
                  components={components}
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw]}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className={`prose dark:prose-invert max-w-none bg-white p-6 rounded-lg shadow ${isFullScreen ? 'ml-16' : ''}`}>
            <ReactMarkdown
              components={components}
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeRaw]}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableMarkdown; 