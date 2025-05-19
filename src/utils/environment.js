/**
 * 检查当前是否在浏览器扩展环境中运行
 * @returns {boolean} 如果在浏览器扩展中运行则返回true，否则返回false
 */
export const isExtensionEnvironment = () => {
  return (
    // Chrome 扩展环境检测
    typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id ||
    // Firefox 扩展环境检测
    typeof browser !== 'undefined' && browser.runtime && browser.runtime.id
  )
}

/**
 * 获取当前运行环境的配置
 * @returns {Object} 包含环境特定配置的对象
 */
export const getEnvironmentConfig = () => {
  const isExtension = isExtensionEnvironment()
  return {
    isExtension,
    routerMode: isExtension ? 'hash' : 'history',
    // 在扩展环境中不需要 base URL
    baseUrl: isExtension ? '' : import.meta.env.BASE_URL,
  }
}