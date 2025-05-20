export function importBookmarks(store, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const rawData = JSON.parse(event.target.result);
        let tagsCount = 0;
        let bookmarksCount = 0;
        let warnings = [];
        
        // 检查数据格式
        // 1. 标准格式: { bookmarks: [...], tags: [...] }
        // 2. 简单格式: [ { name, url, ... }, ... ]
        
        if (Array.isArray(rawData)) {
          // 简单格式 - 直接是书签数组
          const result = await store.dispatch('bookmarks/importBookmarks', rawData);
          bookmarksCount = result.importedCount;
          
          if (result.errors && result.errors.length > 0) {
            warnings = result.errors;
          }
        } else {
          // 标准格式 - 包含bookmarks和tags的对象
          // 导入标签
          if (rawData.tags && Array.isArray(rawData.tags)) {
            const allTags = store.getters['tags/all'];
            for (const tag of rawData.tags) {
              if (!allTags.some(t => t.id === tag.id)) {
                await store.dispatch('tags/addTag', tag);
                tagsCount++;
              }
            }
          }
          
          // 导入书签
          if (rawData.bookmarks && Array.isArray(rawData.bookmarks)) {
            const result = await store.dispatch('bookmarks/importBookmarks', rawData.bookmarks);
            bookmarksCount = result.importedCount;
            
            if (result.errors && result.errors.length > 0) {
              warnings = result.errors;
            }
          }
        }
        
        resolve({
          bookmarksCount,
          tagsCount,
          warnings
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}

export function exportBookmarks(store) {
  return new Promise((resolve, reject) => {
    try {
      const data = {
        bookmarks: store.getters['bookmarks/all'],
        tags: store.getters['tags/all']
      };
      
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      resolve(url);
    } catch (error) {
      reject(error);
    }
  });
}