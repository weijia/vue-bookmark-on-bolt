// 监听标签页更新事件
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 无论是否有URL都更新图标状态
  await updateIconStateForTab(tab);
});

// 监听标签页激活事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await updateIconStateForTab(tab);
});

// 更新图标状态
async function updateIconState(currentUrl) {
  try {
    // 如果URL不存在，直接清除标记并返回
    if (!currentUrl) {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }

    // 从chrome.storage.local获取书签数据
    const result = await chrome.storage.local.get('bookmarks');
    const bookmarks = result.bookmarks || [];

    // 检查URL是否有效
    const isValidUrl = !currentUrl.startsWith('about:') &&
                      !currentUrl.startsWith('chrome://') &&
                      !currentUrl.startsWith('edge://');

    // 检查当前URL是否在书签列表中
    const isBookmarked = isValidUrl && 
                        bookmarks.some(bookmark => 
                          bookmark.url && bookmark.url.toLowerCase() === currentUrl.toLowerCase()
                        );

    // 设置徽章标记
    if (isValidUrl && isBookmarked) {
      await chrome.action.setBadgeText({ text: '✓' });
      await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      await chrome.action.setBadgeTextColor({ color: 'white' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Error updating icon state:', error);
  }
}

async function updateIconStateForTab(tab){
  if (tab){
    updateIconState(tab?.url || '');
  }
}

// 初始化时检查当前标签页
chrome.runtime.onInstalled.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await updateIconStateForTab(tab);
});

// 监听书签更新通知
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'BOOKMARKS_UPDATED') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        updateIconStateForTab(tabs[0]);
      }
    });
  }
});