/**
 * ID转义处理工具
 */

// 仅转义开头的下划线为x5F
export function escapeId(id) {
  if (typeof id !== 'string') return id;
  return id.startsWith('_') ? '%5F' + id.slice(1) : id;
}

// 将开头的x5F还原为下划线
export function unescapeId(id) {
  if (typeof id !== 'string') return id;
  return id.startsWith('%5F') ? '_' + id.slice(3) : id;
}