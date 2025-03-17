/**
 * 复制工具函数
 */

/**
 * 复制文本到剪贴板
 * @param {string} text 要复制的文本
 * @returns {Promise<boolean>} 复制是否成功
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 兼容性处理
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (error) {
    console.error('复制失败:', error);
    return false;
  }
};

/**
 * 从HTML元素中提取纯文本
 * @param {HTMLElement} element HTML元素
 * @returns {string} 提取的纯文本
 */
export const extractTextFromElement = (element) => {
  return element.innerText || element.textContent || '';
};

/**
 * 显示复制成功或失败的提示
 * @param {boolean} success 是否成功
 * @param {string} type 复制类型
 */
export const showCopyNotification = (success, type) => {
  const message = success 
    ? `${type}已复制到剪贴板` 
    : `复制${type}失败`;
  
  // 创建通知元素
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.bottom = '1rem';
  notification.style.right = '1rem';
  notification.style.backgroundColor = success ? '#059669' : '#dc2626';
  notification.style.color = 'white';
  notification.style.padding = '0.5rem 1rem';
  notification.style.borderRadius = '0.25rem';
  notification.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  notification.style.zIndex = '50';
  notification.style.transition = 'opacity 0.3s';
  notification.textContent = message;
  
  // 添加到文档
  document.body.appendChild(notification);
  
  // 2秒后移除
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 2000);
}; 