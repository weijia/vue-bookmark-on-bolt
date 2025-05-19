import { createClient } from 'webdav';

let webdavClient = null;
let isConfigured = false;

export async function configureWebDAV(config) {
  try {
    webdavClient = createClient(config.url, {
      username: config.username,
      password: config.password
    });
    
    // 测试连接
    await webdavClient.getDirectoryContents('/');
    isConfigured = true;
    
    // 确保目录存在
    const path = config.path || '/';
    try {
      await webdavClient.createDirectory(path, { recursive: true });
    } catch (error) {
      if (error.response && error.response.status !== 405) { // 405表示目录已存在
        throw error;
      }
    }
    
    return true;
  } catch (error) {
    console.error('WebDAV configuration error:', error);
    isConfigured = false;
    throw new Error('Failed to configure WebDAV: ' + error.message);
  }
}

export async function saveToWebDAV(filename, data) {
  if (!isConfigured || !webdavClient) {
    throw new Error('WebDAV is not configured');
  }

  try {
    const config = JSON.parse(localStorage.getItem('webdavConfig') || '{}');
    const path = config.path || '/';
    const fullPath = `${path}/${filename}`.replace(/\/+/g, '/');
    
    // 添加重试机制
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
      try {
        // 在保存之前检查文件是否被锁定
        const stat = await webdavClient.stat(fullPath).catch(() => null);
        if (stat && stat.props && stat.props.lockdiscovery) {
          throw { status: 423, message: 'File is locked' };
        }
        
        // 验证数据格式
        if (!Array.isArray(data)) {
          throw new Error('Invalid data format: expected array');
        }
        
        // 保存文件
        await webdavClient.putFileContents(fullPath, JSON.stringify(data, null, 2), {
          overwrite: true,
          lockToken: stat?.props?.locktoken
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
        } else if (error.message === 'Invalid data format: expected array') {
          throw error; // 数据格式错误不需要重试
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
    
    const exists = await webdavClient.exists(fullPath);
    if (!exists) {
      console.warn(`File ${filename} not found on WebDAV server`);
      return null;
    }
    
    // 添加重试机制
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
      try {
        const content = await webdavClient.getFileContents(fullPath, { format: 'text' });
        
        // 验证JSON格式
        try {
          const parsedData = JSON.parse(content);
          
          // 验证数据结构
          if (!Array.isArray(parsedData)) {
            console.warn(`Invalid data format in ${filename}, expected array`);
            return [];
          }
          
          return parsedData;
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
    await Promise.all([
      saveToWebDAV('collection.json', bookmarks),
      saveToWebDAV('tag.json', tags)
    ]);
    return true;
  } catch (error) {
    console.error('Failed to sync to WebDAV:', error);
    throw error;
  }
}