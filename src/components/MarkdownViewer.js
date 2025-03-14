import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

const MarkdownViewer = ({ content, basePath }) => {
  if (!content) return null;

  // 处理图片路径，确保正确显示
  const transformImageUri = (src) => {
    if (src.startsWith('http')) {
      return src;
    }
    // 处理相对路径的图片
    return `${basePath}/${src}`;
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-800">Markdown 内容</h2>
      </div>
      <div className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeRaw]}
          transformImageUri={transformImageUri}
          components={{
            // 自定义表格渲染
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full divide-y divide-gray-200 border" {...props} />
              </div>
            ),
            // 表格行
            tr: ({ node, ...props }) => (
              <tr className="bg-white border-b hover:bg-gray-50" {...props} />
            ),
            // 表格单元格
            td: ({ node, ...props }) => (
              <td className="px-6 py-3 border" {...props} />
            ),
            // 表格头单元格
            th: ({ node, ...props }) => (
              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border" {...props} />
            ),
            // 自定义代码块渲染
            code: ({ node, inline, className, children, ...props }) => {
              return inline ? (
                <code className={`${className} px-1 py-0.5 rounded bg-gray-100`} {...props}>
                  {children}
                </code>
              ) : (
                <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            },
            // 自定义图片渲染
            img: ({ node, ...props }) => (
              <img className="max-w-full h-auto my-4" {...props} loading="lazy" />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MarkdownViewer; 