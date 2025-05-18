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
    
    await webdavClient.putFileContents(fullPath, JSON.stringify(data, null, 2), {
      overwrite: true
    });
    
    return true;
  } catch (error) {
    console.error(`Failed to save ${filename} to WebDAV:`, error);
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
      return null;
    }
    
    const content = await webdavClient.getFileContents(fullPath, { format: 'text' });
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load ${filename} from WebDAV:`, error);
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