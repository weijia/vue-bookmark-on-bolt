import { createWebDAVClient } from './webdav-client';

export default class WebDAVManager {
  constructor() {
    this.webdavClient = null;
    this.isConfigured = false;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.initializationError = null;
  }

  // 初始化状态检查
  #checkInitialization() {
    if (this.initializationError) {
      throw this.initializationError;
    }
    if (!this.isInitialized) {
      throw new Error('WebDAV module is not initialized. Please call configure() first.');
    }
    if (!this.isConfigured || !this.webdavClient) {
      throw new Error('WebDAV is not configured. Please call configure() first.');
    }
  }

  // 配置WebDAV连接
  async configure(config) {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        this.isInitialized = true;
        
        // 确保URL格式正确
        let baseUrl = config.url;
        if (!baseUrl.endsWith('/')) {
          baseUrl += '/';
        }
        if (!baseUrl.includes('/dav')) {
          baseUrl += 'dav/';
        } else if (baseUrl.endsWith('/dav/')) {
          // 已经是正确的格式
        } else if (baseUrl.endsWith('/dav')) {
          baseUrl += '/';
        }

        console.log('Using WebDAV base URL:', baseUrl);

        this.webdavClient = createWebDAVClient(
          baseUrl,
          config.username,
          config.password
        );

        // 测试连接
        // try {
        //   const exists = await this.webdavClient.exists('/');
        // } catch (testError) {
        //   console.warn('Standard connection test failed, trying alternative method...');
        //   const testFile = `${config.path || '/'}/connection-test.txt`.replace(/\/+/g, '/');
        //   try {
        //     await this.webdavClient.putFileContents(testFile, 'test');
        //     await this.webdavClient.request('DELETE', testFile);
        //   } catch (putError) {
        //     throw new Error(`WebDAV connection test failed: ${putError.message}`);
        //   }
        // }

        this.isConfigured = true;

        // 确保目录存在
        // const path = config.path || '/';
        // try {
        //   await this.webdavClient.createDirectory(path, { recursive: true });
        // } catch (dirError) {
        //   if (dirError.message.includes('405')) {
        //     console.log('Directory might already exist or PROPFIND not allowed');
        //     const testFile = `${path}/connection-test.txt`.replace(/\/+/g, '/');
        //     try {
        //       await this.webdavClient.putFileContents(testFile, 'test');
        //       await this.webdavClient.request('DELETE', testFile);
        //     } catch (writeError) {
        //       throw new Error(`Cannot write to WebDAV directory: ${writeError.message}`);
        //     }
        //   } else {
        //     throw dirError;
        //   }
        // }
        
        return true;
      } catch (error) {
        console.error('WebDAV initialization error:', error);
        this.isConfigured = false;
        this.initializationError = new Error(`Failed to initialize WebDAV: ${error.message}`);
        throw this.initializationError;
      }
    })();

    return this.initializationPromise;
  }

  // 保存数据到WebDAV
  async save(filename, data) {
    await this.initializationPromise;
    this.#checkInitialization();

    try {
      const fullPath = filename;
      console.log('WebDAV保存路径:', filename);

      const maxRetries = 3;
      let retryCount = 0;
      let lastError = null;

      while (retryCount < maxRetries) {
        try {
          if (!Array.isArray(data)) {
            throw new Error('Invalid data format: expected array');
          }

          const mergedData = data; // 直接使用原始数据，不再合并远程数据
        

          await this.webdavClient.putFileContents(fullPath, JSON.stringify(mergedData, null, 2), {
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
              await this.webdavClient.request('PUT', fullPath, JSON.stringify(data, null, 2), {
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

  // 从WebDAV加载数据
  async load(filename) {
    await this.initializationPromise;
    this.#checkInitialization();

    try {
      const fullPath = filename.replace(/\/+/g, '/');

      console.log(`load.Loading ${filename} from WebDAV path: ${fullPath}`);

      // try {
      //   const exists = await this.webdavClient.exists(fullPath);
      //   if (!exists) {
      //     console.warn(`File ${filename} not found on WebDAV server`);
      //     return [];
      //   }
      // } catch (existsError) {
      //   console.warn(`Failed to check if ${filename} exists:`, existsError);
      // }

      const maxRetries = 3;
      let retryCount = 0;
      let lastError = null;

      while (retryCount < maxRetries) {
        try {
          const content = await this.webdavClient.getFileContents(fullPath, { format: 'text' });

          try {
            const parsedData = content;

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
              const response = await this.webdavClient.request('GET', fullPath);
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
}