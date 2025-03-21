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
    
    // 计算编辑器的滚动百分比
    const editorScrollTop = editorElement.scrollTop;
    const editorScrollHeight = editorElement.scrollHeight - editorElement.clientHeight;
    const scrollPercentage = editorScrollHeight > 0 ? editorScrollTop / editorScrollHeight : 0;
    
    // 根据百分比设置预览区域的滚动位置
    const previewScrollHeight = previewElement.scrollHeight - previewElement.clientHeight;
    previewElement.scrollTop = scrollPercentage * previewScrollHeight;
    
    setTimeout(() => setIsScrolling(false), 150);
  };

  // 处理预览区域的滚动同步
  const handlePreviewScroll = (e) => {
    if (!previewRef.current || !editorRef.current || isScrolling) return;
    
    setIsScrolling(true);
    
    const editorElement = editorRef.current;
    const previewElement = previewRef.current;
    
    // 计算预览区域的滚动百分比
    const previewScrollTop = previewElement.scrollTop;
    const previewScrollHeight = previewElement.scrollHeight - previewElement.clientHeight;
    const scrollPercentage = previewScrollHeight > 0 ? previewScrollTop / previewScrollHeight : 0;
    
    // 根据百分比设置编辑器的滚动位置
    const editorScrollHeight = editorElement.scrollHeight - editorElement.clientHeight;
    editorElement.scrollTop = scrollPercentage * editorScrollHeight;
    
    setTimeout(() => setIsScrolling(false), 150);
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
    <div className={`relative ${isFullScreen ? '' : ''}`}>
      {/* 编辑按钮 - 放在全屏按钮旁边 */}
      <div className={`fixed ${isFullScreen ? 'top-4' : 'top-20'} left-36 z-50`}>
        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-lg transition-colors"
            >
              保存
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 shadow-lg transition-colors"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-lg transition-colors"
          >
            编辑
          </button>
        )}
      </div>

      <div className={`mt-4 ${isFullScreen ? 'max-w-screen-2xl mx-auto' : ''}`}>
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            <div className="relative h-[calc(100vh-120px)]">
              <textarea
                ref={editorRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onScroll={handleEditorScroll}
                className="w-full h-full p-4 border rounded dark:bg-gray-700 dark:text-white font-mono absolute inset-0 resize-none"
              />
            </div>
            <div className="relative h-[calc(100vh-120px)]">
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
          <div className={`prose dark:prose-invert max-w-none bg-white p-6 rounded-lg shadow ${isFullScreen ? '' : ''}`}>
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