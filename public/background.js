// 监听标签页更新事件
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    await updateIconState(tab.url);
  }
});

// 监听标签页激活事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    await updateIconState(tab.url);
  }
});

// 更新图标状态
async function updateIconState(currentUrl) {
  try {
    // 获取所有书签
    const bookmarks = await chrome.storage.local.get('bookmarks');
    const bookmarkList = bookmarks.bookmarks || [];
    
    // 检查当前URL是否在书签列表中
    const isBookmarked = bookmarkList.some(bookmark => 
      bookmark.url && bookmark.url.toLowerCase() === currentUrl.toLowerCase()
    );

    // 设置图标状态
    const path = isBookmarked ? {
      16: "icons/icon16-bookmarked.png",
      32: "icons/icon32-bookmarked.png",
      48: "icons/icon48-bookmarked.png",
      128: "icons/icon128-bookmarked.png"
    } : {
      16: "icons/icon16.png",
      32: "icons/icon32.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png"
    };

    chrome.action.setIcon({ path });
  } catch (error) {
    console.error('Error updating icon state:', error);
  }
}

// 初始化时检查当前标签页
chrome.runtime.onInstalled.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    await updateIconState(tab.url);
  }
});