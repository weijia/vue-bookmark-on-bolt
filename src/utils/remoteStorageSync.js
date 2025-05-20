import RemoteStorage from 'remotestoragejs';
import Widget from 'remotestorage-widget';

export function createRemoteStorageInstance() {
  return new RemoteStorage({
    logging: false,
    cache: true
  });
}

export function setupRemoteStorageAccess(remoteStorage) {
  remoteStorage.access.claim('bookmarks', 'rw');
  remoteStorage.access.claim('tags', 'rw');
  return remoteStorage;
}

export function setupEventListeners(remoteStorage, callbacks) {
  const { onReady, onConnected, onDisconnected, onError } = callbacks;

  remoteStorage.on('ready', onReady);
  remoteStorage.on('connected', onConnected);
  remoteStorage.on('disconnected', onDisconnected);
  remoteStorage.on('error', onError);

  return remoteStorage;
}

export function handleAccessToken(remoteStorage) {
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('access_token');

  if (accessToken) {
    remoteStorage.remote.connect(accessToken);
    const newUrl = window.location.href.split('?')[0];
    window.history.replaceState({}, document.title, newUrl);
  }

  return remoteStorage;
}

export function attachWidget(remoteStorage, elementId) {
  const widget = new Widget(remoteStorage);
  widget.attach(elementId);
  return widget;
}

export async function syncBookmarks(remoteStorage, store) {
  const bookmarksClient = remoteStorage.scope('/bookmarks');
  const remoteBookmarks = await bookmarksClient.getAll();
  await store.dispatch('bookmarks/syncWithRemote', remoteBookmarks);
  return remoteBookmarks;
}

export async function syncTags(remoteStorage, store) {
  const tagsClient = remoteStorage.scope('/tags');
  const remoteTags = await tagsClient.getAll();
  await store.dispatch('tags/syncWithRemote', remoteTags);
  return remoteTags;
}