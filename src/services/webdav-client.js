/**
 * 自定义 WebDAV 客户端实现
 * 使用 fetch API 和适当的配置来处理 CORS 问题
 */

class WebDAVClient {
  constructor(url, username, password) {
    this.baseURL = url.endsWith('/') ? url : url + '/';
    console.log('WebDAVClient - WebDAV base URL:', this.baseURL);
    this.auth = 'Basic ' + btoa(username + ':' + password);
  }

  async request(method, path, data = null, headers = {}) {
    path = path.replace(/^\/+/g, '');
    console.log('WebDAV request:', method, path, this.baseURL);
    const url = new URL(path, this.baseURL).href;
    console.log(`WebDAV ${method} request to: ${url}`);

    // 在浏览器扩展中使用的特殊配置
    const options = {
      method,
      headers: {
        'Authorization': this.auth,
        ...headers
      },
      // 这些选项对于浏览器扩展环境很重要
      mode: 'cors',
      credentials: 'omit', // 在跨域请求中不发送凭据
    };

    // 只有在有数据时才添加 Content-Type 和 body
    if (data) {
      options.headers['Content-Type'] = 'application/json';
      options.body = typeof data === 'string' ? data : JSON.stringify(data);
    }

    console.log('Request options:', { ...options, headers: { ...options.headers, Authorization: '***' } });

    try {
      const response = await fetch(url, options);
      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error text');
        console.error(`HTTP error! status: ${response.status}, text: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}, text: ${errorText}`);
      }

      // 对于不需要响应体的请求，直接返回 true
      if (method === 'PUT' || method === 'DELETE' || method === 'MKCOL') {
        return true;
      }

      // 尝试解析响应
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        const text = await response.text();
        console.log('Response text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        return text;
      }
    } catch (error) {
      console.error('WebDAV request failed:', error);
      throw error;
    }
  }

  // 检查文件/目录是否存在
  async exists(path) {
    try {
      // 使用 HEAD 请求代替 PROPFIND
      path = path.replace(/^\/+/g, '');
      console.log("before calling fetch", new URL(path, this.baseURL).href)
      const response = await fetch(new URL(path, this.baseURL).href, {
        method: 'HEAD',
        headers: {
          'Authorization': this.auth
        },
        mode: 'cors',
        credentials: 'omit'
      });
      console.log("after calling fetch", response)
      return response.ok;
    } catch (error) {
      console.log('Error checking existence:', error);
      return false;
    }
  }

  // 创建目录
  async createDirectory(path, { recursive = true } = {}) {
    if (recursive) {
      const parts = path.split('/').filter(p => p);
      let currentPath = '';

      for (const part of parts) {
        currentPath += '/' + part;
        try {
          // 首先检查目录是否存在
          const exists = await this.exists(currentPath);
          if (!exists) {
            // 如果目录不存在，尝试创建
            await this.request('MKCOL', currentPath);
          }
        } catch (error) {
          // 如果是 405 错误（方法不允许），可能目录已存在
          if (error.message.includes('405')) {
            console.log(`Directory ${currentPath} might already exist, continuing...`);
            continue;
          }
          // 对于其他错误，尝试使用 PUT 请求创建目录
          try {
            await this.request('PUT', currentPath + '/.keep', '');
            console.log(`Created directory ${currentPath} using PUT method`);
          } catch (putError) {
            console.error(`Failed to create directory ${currentPath}:`, putError);
            throw putError;
          }
        }
      }
      return true;
    }

    try {
      return await this.request('MKCOL', path);
    } catch (error) {
      if (error.message.includes('405')) {
        // 如果 MKCOL 不被允许，尝试使用 PUT
        await this.request('PUT', path + '/.keep', '');
        return true;
      }
      throw error;
    }
  }

  // 获取文件内容
  async getFileContents(path, { format = 'text' } = {}) {
    const response = await this.request('GET', path);
    if (format === 'text') {
      return response;
    }
    return JSON.parse(response);
  }

  // 保存文件内容
  async putFileContents(path, data, { overwrite = true } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'If-Match': overwrite ? '*' : '',
      'Overwrite': overwrite ? 'T' : 'F'
    };

    return this.request('PUT', path, data, headers);
  }

  // 获取目录内容
  async getDirectoryContents(path) {
    return this.request('PROPFIND', path, null, {
      'Depth': '1'
    });
  }
}

export function createWebDAVClient(url, username, password) {
  return new WebDAVClient(url, username, password);
}