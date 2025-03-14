import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const FileUploader = ({ onUploadSuccess, onProcessingStart, onProcessingComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    
    // 检查文件类型
    if (file.type !== 'application/pdf') {
      setError('只能上传PDF文件');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // 创建FormData对象
      const formData = new FormData();
      formData.append('file', file);

      // 上传文件
      const uploadResponse = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (uploadResponse.data.success) {
        onUploadSuccess(uploadResponse.data.filename);
        onProcessingStart();

        // 开始处理PDF
        const processResponse = await axios.post('/api/process', {
          filename: uploadResponse.data.filename,
        });

        if (processResponse.data.success) {
          onProcessingComplete(processResponse.data);
        } else {
          setError(processResponse.data.error || '处理PDF时出错');
        }
      } else {
        setError(uploadResponse.data.error || '上传文件时出错');
      }
    } catch (err) {
      console.error('上传或处理过程中出错:', err);
      setError('上传或处理过程中出错: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  }, [onUploadSuccess, onProcessingStart, onProcessingComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: false,
  });

  return (
    <div className="mb-8">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-2 text-gray-600">正在上传文件...</p>
          </div>
        ) : (
          <div>
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              ></path>
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive ? '拖放PDF文件到这里' : '拖放PDF文件到这里，或点击选择文件'}
            </p>
            <p className="mt-1 text-xs text-gray-500">仅支持PDF文件</p>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
    </div>
  );
};

export default FileUploader; 