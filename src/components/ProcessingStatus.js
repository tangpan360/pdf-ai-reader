import React from 'react';

const ProcessingStatus = ({ isProcessing, filename }) => {
  if (!isProcessing) return null;

  // 安全处理文件名，确保即使文件名为空也能显示合理的信息
  const displayFilename = filename ? filename : '文件';

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
      <div className="flex items-center">
        <div className="mr-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-blue-800">正在处理文件</h3>
          <p className="text-xs text-blue-600 mt-1">
            正在使用magic-pdf处理 {displayFilename}，请稍候...
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProcessingStatus; 