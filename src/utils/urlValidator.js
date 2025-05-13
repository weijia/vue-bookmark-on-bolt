import axios from 'axios'

/**
 * Check if a URL is valid and accessible
 * @param {string} url - The URL to check
 * @returns {Promise<boolean>} - Promise resolving to true if valid, false otherwise
 */
export async function checkUrlValidity(url) {
  if (!url) return false
  
  // First check if URL is valid format
  try {
    new URL(url)
  } catch (e) {
    return false
  }
  
  // Then try to fetch the URL to see if it's accessible
  try {
    // Use a timeout to prevent long waits
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await axios.head(url, {
      signal: controller.signal,
      validateStatus: status => status < 400, // Consider any non-4xx, non-5xx status as success
    })
    
    clearTimeout(timeoutId)
    return true
  } catch (error) {
    // If head request fails, try a GET request as some servers might not support HEAD
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await axios.get(url, {
        signal: controller.signal,
        validateStatus: status => status < 400,
      })
      
      clearTimeout(timeoutId)
      return true
    } catch (error) {
      return false
    }
  }
}

/**
 * Extract domain from URL
 * @param {string} url - The URL to extract domain from
 * @returns {string} - The domain name
 */
export function extractDomain(url) {
  try {
    const domain = new URL(url).hostname
    return domain
  } catch (e) {
    return url
  }
}

/**
 * Get favicon URL for a website
 * @param {string} url - The website URL
 * @returns {string} - The favicon URL
 */
export function getFaviconUrl(url) {
  try {
    const origin = new URL(url).origin
    return `${origin}/favicon.ico`
  } catch (e) {
    return null
  }
}