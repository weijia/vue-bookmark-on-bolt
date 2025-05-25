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

    // 提取域名和检查URL是否只有域名部分的辅助函数
    function extractUrlParts(url) {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.toLowerCase();
        // 检查URL是否只有域名部分（路径为"/"或为空）
        const hasOnlyDomain = (urlObj.pathname === "/" || urlObj.pathname === "") && !urlObj.search && !urlObj.hash;
        return { domain, hasOnlyDomain };
      } catch (e) {
        return { domain: url.toLowerCase(), hasOnlyDomain: false };
      }
    }

    // 检查当前URL是否在书签列表中
    const isBookmarked = isValidUrl && bookmarks.some(bookmark => {
      if (!bookmark.url) return false;
      
      // 首先检查完全匹配
      if (bookmark.url.toLowerCase() === currentUrl.toLowerCase()) {
        return true;
      }
      
      // 如果没有完全匹配，检查域名是否匹配，但只有当书签URL没有路径部分时才算匹配
      const bookmarkParts = extractUrlParts(bookmark.url);
      const currentParts = extractUrlParts(currentUrl);
      
      // 只有当书签URL只包含域名部分（没有路径）时，才进行域名匹配
      return bookmarkParts.hasOnlyDomain && bookmarkParts.domain === currentParts.domain;
    });

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

// 监听书签更新通知和添加书签请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'BOOKMARKS_UPDATED') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        updateIconStateForTab(tabs[0]);
      }
    });
  } else if (request.type === 'GET_CURRENT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          url: tabs[0].url,
          title: tabs[0].title
        });
      }
    });
    return true; // 保持消息通道开放以进行异步响应
  } else if (request.type === 'ADD_BOOKMARK') {
    const { bookmark } = request;
    
    // 获取书签和标签数据
    chrome.storage.local.get(['bookmarks', 'tags'], (result) => {
      const bookmarks = result.bookmarks || [];
      const tags = result.tags || [];
      
      // 处理标签
      const processedTags = [];
      const tagIds = [];
      
      // 处理每个标签字符串
      if (bookmark.tags && Array.isArray(bookmark.tags)) {
        bookmark.tags.forEach(tagName => {
          // 查找现有标签
          let tag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
          
          // 如果标签不存在，创建新标签
          if (!tag) {
            tag = {
              id: crypto.randomUUID(), // 生成唯一ID
              name: tagName,
              color: '#' + Math.floor(Math.random()*16777215).toString(16), // 随机颜色
              createdAt: new Date().toISOString()
            };
            tags.push(tag);
            processedTags.push(tag);
          }
          
          tagIds.push(tag.id);
        });
      }
      
      // 更新bookmark对象，将tags字符串数组替换为tagIds
      const processedBookmark = {
        ...bookmark,
        tagIds: tagIds,
        tags: undefined // 移除原始的tags字符串数组
      };
      
      // 检查是否已存在相同ID的书签（更新）或相同URL的书签（新增）
      const existingIndex = processedBookmark.id ? 
        bookmarks.findIndex(b => b.id === processedBookmark.id) :
        bookmarks.findIndex(b => b.url === processedBookmark.url);
      
      if (existingIndex >= 0) {
        // 更新现有书签，保留原有的createdAt
        const originalCreatedAt = bookmarks[existingIndex].createdAt;
        bookmarks[existingIndex] = { 
          ...processedBookmark,
          createdAt: originalCreatedAt || processedBookmark.createdAt // 确保保留原始创建时间
        };
      } else {
        // 添加新书签
        bookmarks.push(processedBookmark);
      }
      
      // 保存更新后的书签和标签
      chrome.storage.local.set({ bookmarks, tags }, () => {
        // 更新图标状态
        updateIconStateForTab({ url: bookmark.url });
        
        // 发送书签更新通知
        chrome.runtime.sendMessage({ 
          type: 'BOOKMARKS_UPDATED',
          bookmarks: bookmarks
        });
        
        // 响应popup的请求
        sendResponse({ success: true });
      });
    });
    return true; // 保持消息通道开放以进行异步响应
  }
});