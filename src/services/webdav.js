import { createWebDAVClient } from './webdav-client';

let webdavClient = null;
let isConfigured = false;
let isInitialized = false;
let initializationPromise = null;
let initializationError = null;

// 初始化状态检查
function checkInitialization() {
  if (initializationError) {
    throw initializationError;
  }
  if (!isInitialized) {
    throw new Error('WebDAV module is not initialized. Please call configureWebDAV() first.');
  }
  if (!isConfigured || !webdavClient) {
    throw new Error('WebDAV is not configured. Please call configureWebDAV() first.');
  }
}

export function renameKeysInArray(data, mapping) {
  return data.map(obj => {
    const renamedObj = {};

    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        // 如果存在映射，使用新键名；否则保留原键名
        const newKey = mapping.hasOwnProperty(key) ? mapping[key] : key;
        renamedObj[newKey] = obj[key];
      }
    }

    return renamedObj;
  });
}

export async function initializeWebDAV(config) {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      isInitialized = true;
      
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

      // 测试连接
      try {
        // const testUrl = new URL(config.url).pathname || '/';
        const exists = await webdavClient.exists('/');
        if (!exists) {
          throw new Error('WebDAV server not accessible');
        }
      } catch (testError) {
        console.warn('Standard connection test failed, trying alternative method...');
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
        if (dirError.message.includes('405')) {
          console.log('Directory might already exist or PROPFIND not allowed');
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
      console.error('WebDAV initialization error:', error);
      isConfigured = false;
      initializationError = new Error(`Failed to initialize WebDAV: ${error.message}`);
      throw initializationError;
    }
  })();

  return initializationPromise;
}

// 兼容旧版API
export async function configureWebDAV(config) {
  return initializeWebDAV(config);
}

// 合并数据函数
function mergeData(localData, remoteData) {
  if (!Array.isArray(localData) || !Array.isArray(remoteData)) {
    throw new Error('Invalid data format: expected arrays');
  }

  const mergedMap = new Map();
  remoteData.forEach(item => {
    if (item.id) {
      mergedMap.set(item.id, { ...item });
    }
  });

  localData.forEach(item => {
    if (item.id) {
      const existingItem = mergedMap.get(item.id);
      if (!existingItem || (item.updatedAt && existingItem.updatedAt && new Date(item.updatedAt) > new Date(existingItem.updatedAt))) {
        mergedMap.set(item.id, { ...item });
      }
    }
  });

  return Array.from(mergedMap.values());
}

export async function saveToWebDAV(filename, localData) {
  await initializationPromise;
  checkInitialization();

  try {
    const config = JSON.parse(localStorage.getItem('webdavConfig') || '{}');
    const fullPath = filename;
    console.log('WebDAV保存路径:', filename);

    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;

    while (retryCount < maxRetries) {
      try {
        if (!Array.isArray(localData)) {
          throw new Error('Invalid local data format: expected array');
        }

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
          remoteData = [];
        }

        const transformedLocalData = renameKeysInArray(localData, {title: "name"})

        const mergedData = mergeData(transformedLocalData, remoteData);
        console.log(`Merged data: local(${localData.length}) + remote(${remoteData.length}) = merged(${mergedData.length})`);

        await webdavClient.putFileContents(fullPath, JSON.stringify(mergedData, null, 2), {
          overwrite: true
        });

        return true;
      } catch (error) {
        lastError = error;
        retryCount++;

        if (error.status === 409) {
          console.warn(`Conflict detected when saving ${filename}, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.status === 423) {
          console.warn(`File ${filename} is locked, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.status >= 500) {
          console.warn(`Server error when saving ${filename}, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.message.includes('405')) {
          try {
            await webdavClient.request('PUT', fullPath, JSON.stringify(transformedLocalData, null, 2), {
              'Content-Type': 'application/json'
            });
            return true;
          } catch (putError) {
            lastError = putError;
            break;
          }
        } else {
          break;
        }

        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    return false;
  } catch (error) {
    console.error(`Failed to save ${filename} to WebDAV:`, error);

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
  await initializationPromise;
  checkInitialization();

  try {
    const config = JSON.parse(localStorage.getItem('webdavConfig') || '{}');
    const path = config.path || '/';
    const fullPath = `${path}/${filename}`.replace(/\/+/g, '/');

    console.log(`Loading ${filename} from WebDAV path: ${fullPath}`);

    try {
      const exists = await webdavClient.exists(fullPath);
      if (!exists) {
        console.warn(`File ${filename} not found on WebDAV server`);
        return [];
      }
    } catch (existsError) {
      console.warn(`Failed to check if ${filename} exists:`, existsError);
    }

    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;

    while (retryCount < maxRetries) {
      try {
        const content = await webdavClient.getFileContents(fullPath, { format: 'text' });
        // console.log(content)

        try {
          const parsedData = content; //JSON.parse(content);

          if (!Array.isArray(parsedData)) {
            console.warn(`Invalid data format in ${filename}, expected array`);
            return [];
          }

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

        if (error.status === 409) {
          console.warn(`Conflict detected when loading ${filename}, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.status === 423) {
          console.warn(`File ${filename} is locked, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.status >= 500) {
          console.warn(`Server error when loading ${filename}, retrying (${retryCount}/${maxRetries})...`);
        } else if (error.message.includes('405')) {
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
          break;
        }
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        }
      }
    }
    
    if (lastError) {
      throw lastError;
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to load ${filename} from WebDAV:`, error);
    
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
  await initializationPromise;
  checkInitialization();

  try {
    const config = JSON.parse(localStorage.getItem('webdavConfig') || '{}');
    const userPath = config.path ? config.path.replace(/^\/|\/$/g, '') : '';
    const path = `${userPath}`.replace(/\/+/g, '/');

    console.log('Starting WebDAV sync with path:', path);
    console.log('Full WebDAV URL:', webdavClient.baseURL + path);

    if (!Array.isArray(bookmarks) || !Array.isArray(tags)) {
      throw new Error('Invalid data format: expected arrays');
    }

    console.log(`Syncing ${bookmarks.length} bookmarks and ${tags.length} tags`);

    const bookmarksPath = `${path}/collection.json`.replace(/\/+/g, '/');
    console.log('Saving bookmarks to:', bookmarksPath);
    await saveToWebDAV(bookmarksPath, bookmarks);

    const tagsPath = `${path}/tag.json`.replace(/\/+/g, '/');
    console.log('Saving tags to:', tagsPath);
    await saveToWebDAV(tagsPath, tags);

    console.log('WebDAV sync completed successfully');
    return true;
  } catch (error) {
    console.error('Failed to sync to WebDAV:', error);
    
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