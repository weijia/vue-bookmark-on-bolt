import { createWebDAVClient } from './webdav-client';

let webdavClient = null;
let isConfigured = false;

export async function configureWebDAV(config) {
  try {
    // 确保URL以/结尾
    let baseUrl = config.url;
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }

    // 确保URL包含/dav路径但不重复
    if (!baseUrl.includes('/dav')) {
      baseUrl += 'dav/';
    } else if (baseUrl.endsWith('/dav/')) {
      // 已经是正确的格式
    } else if (baseUrl.endsWith('/dav')) {
      baseUrl += '/';
    }

    console.log('Using WebDAV base URL:', baseUrl);

    webdavClient = createWebDAVClient(
      baseUrl,
      config.username,
      config.password
    );

    // 测试连接 - 使用 HEAD 请求代替 PROPFIND
    try {
      const testUrl = new URL(config.url).pathname || '/';
      const exists = await webdavClient.exists(testUrl);
      if (!exists) {
        throw new Error('WebDAV server not accessible');
      }
    } catch (testError) {
      console.warn('Standard connection test failed, trying alternative method...');
      // 尝试使用 PUT 方法测试连接
      const testFile = `${config.path || '/'}/connection-test.txt`.replace(/\/+/g, '/');
      try {
        await webdavClient.putFileContents(testFile, 'test');
        await webdavClient.request('DELETE', testFile);
      } catch (putError) {
        throw new Error(`WebDAV connection test failed: ${putError.message}`);
      }
    }

    isConfigured = true;

    // 确保目录存在
    const path = config.path || '/';
    try {
      await webdavClient.createDirectory(path, { recursive: true });
    } catch (dirError) {
      // 405 错误可能表示目录已存在或方法不被允许
      if (dirError.message.includes('405')) {
        console.log('Directory might already exist or PROPFIND not allowed');
        // 尝试写入测试文件确认目录可写
        const testFile = `${path}/connection-test.txt`.replace(/\/+/g, '/');
        try {
          await webdavClient.putFileContents(testFile, 'test');
          await webdavClient.request('DELETE', testFile);
        } catch (writeError) {
          throw new Error(`Cannot write to WebDAV directory: ${writeError.message}`);
        }
      } else {
        throw dirError;
      }
    }
    
    return true;
  } catch (error) {
    console.error('WebDAV configuration error:', error);
    isConfigured = false;
    throw new Error(`Failed to configure WebDAV: ${error.message}. Please check server URL and credentials.`);
  }
}

// 合并数据函数
function mergeData(localData, remoteData) {
  if (!Array.isArray(localData) || !Array.isArray(remoteData)) {
    throw new Error('Invalid data format: expected arrays');
  }

  // 使用 Map 来存储合并后的数据，键为项目的唯一标识符
  const mergedMap = new Map();

  // 首先添加远程数据
  remoteData.forEach(item => {
    if (item.id) {
      mergedMap.set(item.id, { ...item });
    }
  });

  // 然后添加或更新本地数据
  localData.forEach(item => {
    if (item.id) {
      const existingItem = mergedMap.get(item.id);
      if (!existingItem || (item.updatedAt && existingItem.updatedAt && new Date(item.updatedAt) > new Date(existingItem.updatedAt))) {
        mergedMap.set(item.id, { ...item });
      }
    }
  });

  // 转换回数组
  return Array.from(mergedMap.values());
}

export async function saveToWebDAV(filename, localData) {
  if (!isConfigured || !webdavClient) {
    throw new Error('WebDAV is not configured');
  }

  try {
    const config = JSON.parse(localStorage.getItem('webdavConfig') || '{}');
    
    const fullPath = filename;
    console.log('WebDAV保存路径:', filename);

    // 添加重试机制
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;

    while (retryCount < maxRetries) {
      try {
        // 验证本地数据格式
        if (!Array.isArray(localData)) {
          throw new Error('Invalid local data format: expected array');
        }

        // 首先尝试获取远程数据
        let remoteData = [];
        try {
          const remoteContent = await webdavClient.getFileContents(fullPath, { format: 'text' });
          remoteData = JSON.parse(remoteContent);
          if (!Array.isArray(remoteData)) {
            console.warn('Invalid remote data format, treating as empty array');
            remoteData = [];
          }
        } catch (error) {
          if (!error.message.includes('404')) {
            console.warn('Error fetching remote data:', error);
          }
          // 如果文件不存在或其他错误，使用空数组
          remoteData = [];
        }

        // 合并本地和远程数据
        const mergedData = mergeData(localData, remoteData);
        console.log(`Merged data: local(${localData.length}) + remote(${remoteData.length}) = merged(${mergedData.length})`);

        // 保存合并后的数据
        await webdavClient.putFileContents(fullPath, JSON.stringify(mergedData, null, 2), {
          overwrite: true
        });

        return true;
      } catch (error) {
        lastError = error;
        retryCount++;
        
        // 处理特定错误
        if (error.status === 409) {
          console.warn(`Conflict detected when saving ${filename}, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.status === 423) {
          console.warn(`File ${filename} is locked, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.status >= 500) {
          console.warn(`Server error when saving ${filename}, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.message.includes('405')) {
          // 方法不被允许，尝试直接PUT
          try {
            await webdavClient.request('PUT', fullPath, JSON.stringify(localData, null, 2), {
              'Content-Type': 'application/json'
            });
            return true;
          } catch (putError) {
            lastError = putError;
            break;
          }
        } else {
          // 对于其他错误，不重试
          break;
        }
        
        // 指数退避重试
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        }
      }
    }
    
    // 如果所有重试都失败
    if (lastError) {
      throw lastError;
    }
    
    return false;
  } catch (error) {
    console.error(`Failed to save ${filename} to WebDAV:`, error);
    
    // 提供更具体的错误信息
    if (error.status === 401 || error.status === 403) {
      throw new Error(`WebDAV authentication error: ${error.message}`);
    } else if (error.status === 409) {
      throw new Error(`WebDAV conflict error: ${error.message}`);
    } else if (error.status === 423) {
      throw new Error(`WebDAV file lock error: ${error.message}`);
    } else if (error.status >= 500) {
      throw new Error(`WebDAV server error: ${error.message}`);
    } else if (error.message.includes('405')) {
      throw new Error(`WebDAV method not allowed: ${error.message}`);
    }
    
    throw error;
  }
}

export async function loadFromWebDAV(filename) {
  if (!isConfigured || !webdavClient) {
    throw new Error('WebDAV is not configured');
  }

  try {
    const config = JSON.parse(localStorage.getItem('webdavConfig') || '{}');
    const path = config.path || '/';
    const fullPath = `${path}/${filename}`.replace(/\/+/g, '/');
    
    console.log(`Loading ${filename} from WebDAV path: ${fullPath}`);
    
    // 检查文件是否存在 - 使用 HEAD 请求
    try {
      const exists = await webdavClient.exists(fullPath);
      if (!exists) {
        console.warn(`File ${filename} not found on WebDAV server`);
        return [];
      }
    } catch (existsError) {
      // 如果检查存在失败（可能是 405 错误），继续尝试加载
      console.warn(`Failed to check if ${filename} exists:`, existsError);
    }
    
    // 添加重试机制
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
      try {
        // 首先尝试标准方法
        const content = await webdavClient.getFileContents(fullPath, { format: 'text' });

        // 验证JSON格式
        try {
          const parsedData = JSON.parse(content);

          // 验证数据结构
          if (!Array.isArray(parsedData)) {
            console.warn(`Invalid data format in ${filename}, expected array`);
            return [];
          }

          // 验证数据项
          const validatedData = parsedData.filter(item => {
            if (!item || typeof item !== 'object' || !item.id) {
              console.warn('Found invalid item in WebDAV data:', item);
              return false;
            }
            return true;
          });

          if (validatedData.length !== parsedData.length) {
            console.warn(`Filtered out ${parsedData.length - validatedData.length} invalid items from WebDAV data`);
          }

          console.log(`Successfully loaded ${validatedData.length} items from ${filename}`);
          return validatedData;
        } catch (parseError) {
          console.error(`Error parsing ${filename} from WebDAV:`, parseError);
          return [];
        }
      } catch (error) {
        lastError = error;
        retryCount++;

        // 处理特定错误
        if (error.status === 409) {
          console.warn(`Conflict detected when loading ${filename}, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.status === 423) {
          console.warn(`File ${filename} is locked, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.status >= 500) {
          console.warn(`Server error when loading ${filename}, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.message.includes('405')) {
          // 方法不被允许，尝试直接GET
          try {
            const response = await webdavClient.request('GET', fullPath);
            const parsedData = JSON.parse(response);
            
            if (!Array.isArray(parsedData)) {
              console.warn(`Invalid data format in ${filename}, expected array`);
              return [];
            }
            
            return parsedData;
          } catch (getError) {
            lastError = getError;
            break;
          }
        } else {
          // 对于其他错误，不重试
          break;
        }
        
        // 指数退避重试
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        }
      }
    }
    
    // 如果所有重试都失败
    if (lastError) {
      throw lastError;
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to load ${filename} from WebDAV:`, error);
    
    // 提供更具体的错误信息
    if (error.status === 401 || error.status === 403) {
      throw new Error(`WebDAV authentication error: ${error.message}`);
    } else if (error.status === 409) {
      throw new Error(`WebDAV conflict error: ${error.message}`);
    } else if (error.status >= 500) {
      throw new Error(`WebDAV server error: ${error.message}`);
    }
    
    throw error;
  }
}

export async function syncToWebDAV(bookmarks, tags) {
  if (!isConfigured || !webdavClient) {
    throw new Error('WebDAV is not configured');
  }

  try {
    const config = JSON.parse(localStorage.getItem('webdavConfig') || '{}');
    // 获取用户配置的路径，去除开头和结尾的斜杠
    const userPath = config.path ? config.path.replace(/^\/|\/$/g, '') : '';
    console.log("syncToWebDAV", config.path, userPath)
    // 最终路径是服务器根路径/dav/加上用户路径
    const path = `${userPath}`.replace(/\/+/g, '/');

    console.log('Starting WebDAV sync with path:', path);
    console.log('Full WebDAV URL:', webdavClient.baseURL + path);

    // 验证数据格式
    if (!Array.isArray(bookmarks) || !Array.isArray(tags)) {
      throw new Error('Invalid data format: expected arrays');
    }

    // 准备合并数据
    console.log(`Syncing ${bookmarks.length} bookmarks and ${tags.length} tags`);

    // 保存书签
    const bookmarksPath = `${path}/collection.json`.replace(/\/+/g, '/');
    console.log('Saving bookmarks to:', bookmarksPath);
    await saveToWebDAV(bookmarksPath, bookmarks);

    // 保存标签
    const tagsPath = `${path}/tag.json`.replace(/\/+/g, '/');
    console.log('Saving tags to:', tagsPath);
    await saveToWebDAV(tagsPath, tags);

    console.log('WebDAV sync completed successfully');
    return true;
  } catch (error) {
    console.error('Failed to sync to WebDAV:', error);
    
    // 提供更具体的错误信息
    if (error.message.includes('401') || error.message.includes('403')) {
      throw new Error(`WebDAV authentication error: ${error.message}`);
    } else if (error.message.includes('404')) {
      throw new Error(`WebDAV path not found: ${error.message}`);
    } else if (error.message.includes('405')) {
      throw new Error(`WebDAV method not allowed: ${error.message}`);
    } else if (error.message.includes('500')) {
      throw new Error(`WebDAV server error: ${error.message}`);
    }
    
    throw error;
  }
}