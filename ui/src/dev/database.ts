function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lingui-development-studio', 2)
    request.onupgradeneeded = () => {
      for (const name of ['templates', 'themes', 'fonts'])
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, { keyPath: 'id' })
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(new Error('无法打开本机组件库，请检查浏览器存储权限'))
    request.onblocked = () => reject(new Error('本机存储需要升级，请关闭其他旧版工作台窗口后重试'))
  })
}
export async function localOperation<T>(
  store: string,
  mode: IDBTransactionMode,
  execute: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode),
      request = execute(transaction.objectStore(store))
    let result: T
    request.onsuccess = () => {
      result = request.result
    }
    transaction.oncomplete = () => {
      db.close()
      resolve(result)
    }
    transaction.onabort = transaction.onerror = () => {
      db.close()
      reject(new Error('本机保存失败，请检查存储空间'))
    }
  })
}
