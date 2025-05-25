// 当前标签页信息
let currentTab = null;
// 当前选中的标签
let selectedTags = [];
// 可用的标签列表
let availableTags = [];
// 当前正在编辑的书签
let currentBookmark = null;

// DOM元素
const mainButtonsDiv = document.getElementById('mainButtons');
const bookmarkFormDiv = document.getElementById('bookmarkForm');
const addCurrentPageBtn = document.getElementById('addCurrentPage');
const saveBookmarkBtn = document.getElementById('saveBookmark');
const cancelBookmarkBtn = document.getElementById('cancelBookmark');
const titleInput = document.getElementById('title');
const urlInput = document.getElementById('url');
const descriptionInput = document.getElementById('description');
const tagInput = document.getElementById('tagInput');
const tagContainer = document.getElementById('tagContainer');
const statusDiv = document.getElementById('status');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 获取当前标签页信息并检查是否已收藏
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      currentTab = {
        url: tabs[0].url,
        title: tabs[0].title
      };
      
      // 检查当前页面是否已收藏
      chrome.storage.local.get(['bookmarks'], (result) => {
        const bookmarks = result.bookmarks || [];
        const existingBookmark = findMatchingBookmark(currentTab.url, bookmarks);
        
        if (existingBookmark) {
          // 如果已收藏，直接显示编辑表单
          showBookmarkForm(existingBookmark);
          addCurrentPageBtn.textContent = '更新书签';
        }
      });
    }
  });

  // 添加事件监听器
  addCurrentPageBtn.addEventListener('click', () => showBookmarkForm());
  saveBookmarkBtn.addEventListener('click', saveBookmark);
  cancelBookmarkBtn.addEventListener('click', hideBookmarkForm);
  tagInput.addEventListener('keydown', handleTagInput);
  
  // 添加标签搜索输入事件监听
  tagInput.addEventListener('input', handleTagSearch);
  
  // 加载所有可用标签
  loadAvailableTags();
});

// 加载所有可用标签
function loadAvailableTags() {
  chrome.storage.local.get(['tags'], (result) => {
    const tags = result.tags || [];
    // 使用store中的tags数据
    availableTags = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      count: tag.count || 0
    }));
  });
}

// 处理标签搜索
function handleTagSearch(event) {
  const searchText = event.target.value.trim().toLowerCase();
  
  // 如果搜索框为空，隐藏搜索结果
  if (!searchText) {
    hideTagSearchResults();
    return;
  }
  
  // 过滤匹配的标签
  const matchingTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(searchText) && 
    !selectedTags.some(selectedTag => 
      typeof selectedTag === 'string' 
        ? selectedTag === tag.name 
        : selectedTag.name === tag.name
    )
  );
  
  // 按使用频率排序
  matchingTags.sort((a, b) => {
    // 首先按照是否以搜索文本开头排序
    const aStartsWith = a.name.toLowerCase().startsWith(searchText);
    const bStartsWith = b.name.toLowerCase().startsWith(searchText);
    
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;
    
    // 然后按使用频率排序
    return (b.count || 0) - (a.count || 0);
  });
  
  // 显示搜索结果
  showTagSearchResults(matchingTags);
}

// 显示标签搜索结果
function showTagSearchResults(tags) {
  const resultsContainer = document.getElementById('tagSearchResults') || 
    createTagSearchResultsContainer();
  
  resultsContainer.innerHTML = '';
  
  if (tags.length === 0) {
    resultsContainer.style.display = 'none';
    return;
  }
  
  tags.forEach(tag => {
    const tagElement = document.createElement('div');
    tagElement.className = 'tag-result';
    
    // 创建颜色指示器
    const colorIndicator = document.createElement('span');
    colorIndicator.className = 'tag-color';
    colorIndicator.style.backgroundColor = tag.color || '#ccc';
    
    // 创建标签名称元素
    const nameElement = document.createElement('span');
    nameElement.className = 'tag-name';
    
    // 高亮匹配的文本
    const searchText = tagInput.value.trim().toLowerCase();
    const tagName = tag.name;
    const index = tagName.toLowerCase().indexOf(searchText);
    
    if (index >= 0) {
      const before = tagName.substring(0, index);
      const match = tagName.substring(index, index + searchText.length);
      const after = tagName.substring(index + searchText.length);
      nameElement.innerHTML = `${before}<strong>${match}</strong>${after}`;
    } else {
      nameElement.textContent = tagName;
    }
    
    // 添加使用次数指示器
    const countElement = document.createElement('span');
    countElement.className = 'tag-count';
    countElement.textContent = tag.count ? `(${tag.count})` : '';
    
    // 组装标签元素
    tagElement.appendChild(colorIndicator);
    tagElement.appendChild(nameElement);
    tagElement.appendChild(countElement);
    
    tagElement.addEventListener('click', () => {
      selectedTags.push(tag);
      renderTags();
      tagInput.value = '';
      hideTagSearchResults();
    });
    
    resultsContainer.appendChild(tagElement);
  });
  
  resultsContainer.style.display = 'block';
}

// 创建标签搜索结果容器
function createTagSearchResultsContainer() {
  const container = document.createElement('div');
  container.id = 'tagSearchResults';
  container.className = 'tag-search-results';
  tagInput.parentNode.insertBefore(container, tagInput.nextSibling);
  return container;
}

// 隐藏标签搜索结果
function hideTagSearchResults() {
  const resultsContainer = document.getElementById('tagSearchResults');
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
}

// 显示添加书签表单
function showBookmarkForm(existingBookmark = null) {
  mainButtonsDiv.style.display = 'none';
  bookmarkFormDiv.style.display = 'block';
  
  // 重置表单
  selectedTags = [];
  
  if (existingBookmark) {
    // 如果传入了现有书签，使用其信息填充表单
    currentBookmark = existingBookmark;
    titleInput.value = existingBookmark.title || '';
    urlInput.value = existingBookmark.url || '';
    descriptionInput.value = existingBookmark.description || '';
    
    // 填充标签
    if (existingBookmark.tagIds && Array.isArray(existingBookmark.tagIds)) {
      // 从availableTags中找到对应的完整tag对象
      selectedTags = existingBookmark.tagIds
        .map(tagId => availableTags.find(tag => tag.id === tagId))
        .filter(tag => tag); // 过滤掉未找到的tag
      renderTags();
    }
    
    // 更改保存按钮文本
    saveBookmarkBtn.textContent = '更新书签';
  } else {
    // 否则使用当前页面信息
    currentBookmark = null;
    
    if (currentTab) {
      titleInput.value = currentTab.title || '';
      urlInput.value = currentTab.url || '';
      descriptionInput.value = '';
    }
    
    // 检查是否已经存在此书签
    checkExistingBookmark();
    
    // 重置保存按钮文本
    saveBookmarkBtn.textContent = '保存书签';
  }
}

// 隐藏添加书签表单
function hideBookmarkForm() {
  mainButtonsDiv.style.display = 'block';
  bookmarkFormDiv.style.display = 'none';
  resetForm();
}

// 重置表单
function resetForm() {
  titleInput.value = '';
  urlInput.value = '';
  descriptionInput.value = '';
  tagInput.value = '';
  selectedTags = [];
  tagContainer.innerHTML = '';
  hideStatus();
}

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

// 查找匹配的书签
function findMatchingBookmark(url, bookmarks) {
  if (!url) return null;
  
  // 首先检查完全匹配
  const exactMatch = bookmarks.find(b => b.url === url);
  if (exactMatch) return exactMatch;
  
  // 如果没有完全匹配，检查域名是否匹配，但只有当书签URL没有路径部分时才算匹配
  const currentParts = extractUrlParts(url);
  
  return bookmarks.find(bookmark => {
    if (!bookmark.url) return false;
    
    const bookmarkParts = extractUrlParts(bookmark.url);
    
    // 只有当书签URL只包含域名部分（没有路径）时，才进行域名匹配
    return bookmarkParts.hasOnlyDomain && bookmarkParts.domain === currentParts.domain;
  });
}

// 检查是否已经存在此书签
function checkExistingBookmark() {
  if (!currentTab || !currentTab.url) return;
  
  chrome.storage.local.get(['bookmarks'], (result) => {
    const bookmarks = result.bookmarks || [];
    const existingBookmark = findMatchingBookmark(currentTab.url, bookmarks);
    
    if (existingBookmark) {
      // 填充现有书签信息
      titleInput.value = existingBookmark.title || '';
      urlInput.value = existingBookmark.url || '';
      descriptionInput.value = existingBookmark.description || '';
      
      // 填充标签
      if (existingBookmark.tagIds && Array.isArray(existingBookmark.tagIds)) {
        // 从availableTags中找到对应的完整tag对象
        selectedTags = existingBookmark.tagIds
          .map(tagId => availableTags.find(tag => tag.id === tagId))
          .filter(tag => tag); // 过滤掉未找到的tag
        renderTags();
      }
    }
  });
}

// 处理标签输入
function handleTagInput(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const tagName = tagInput.value.trim();
    
    if (tagName && !selectedTags.includes(tagName)) {
      selectedTags.push(tagName);
      renderTags();
    }
    
    tagInput.value = '';
  }
}

// 渲染标签
function renderTags() {
  tagContainer.innerHTML = '';
  // console.log('Rendering tags:', selectedTags);

  selectedTags.forEach((tag, index) => {
    const tagElement = document.createElement('div');
    tagElement.className = 'tag';
    if (tag.color) {
      tagElement.style.backgroundColor = tag.color;
      // 根据背景色深浅自动调整文字颜色
      const r = parseInt(tag.color.slice(1, 3), 16);
      const g = parseInt(tag.color.slice(3, 5), 16);
      const b = parseInt(tag.color.slice(5, 7), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      tagElement.style.color = brightness > 128 ? '#000' : '#fff';
    }
    
    const tagText = document.createElement('span');
    tagText.textContent = tag.name;
    
    const removeButton = document.createElement('button');
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => {
      selectedTags.splice(index, 1);
      renderTags();
    });
    
    tagElement.appendChild(tagText);
    tagElement.appendChild(removeButton);
    tagContainer.appendChild(tagElement);
  });
}

// 保存书签
function saveBookmark() {
  const title = titleInput.value.trim();
  const url = urlInput.value.trim();
  const description = descriptionInput.value.trim();
  
  if (!title || !url) {
    showStatus('标题和URL不能为空', 'error');
    return;
  }
  
  // 创建书签对象
  const bookmark = {
    title,
    url,
    description,
    tagIds: selectedTags.map(tag => tag.id), // 直接保存tagIds而不是完整的tag对象
    updatedAt: new Date().toISOString()
  };
  
  // 如果是更新现有书签
  if (currentBookmark) {
    bookmark.id = currentBookmark.id;
    bookmark.createdAt = currentBookmark.createdAt;
  } else {
    // 新书签
    bookmark.id = Date.now().toString();
    bookmark.createdAt = new Date().toISOString();
  }
  
  // 发送消息到background.js添加或更新书签
  chrome.runtime.sendMessage(
    { type: 'ADD_BOOKMARK', bookmark },
    (response) => {
      if (response && response.success) {
        showStatus(currentBookmark ? '书签已成功更新' : '书签已成功保存', 'success');
        setTimeout(() => {
          hideBookmarkForm();
        }, 1500);
      } else {
        showStatus('操作书签时出错', 'error');
      }
    }
  );
}

// 显示状态消息
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
}

// 隐藏状态消息
function hideStatus() {
  statusDiv.style.display = 'none';
}