import { validateSnapshot, type CreationRecord } from './types'
export class HistoryConflictError extends Error {}
export interface CreationHistoryRepository {
  list(scope: string): Promise<CreationRecord[]>
  save(record: CreationRecord): Promise<CreationRecord>
  remove(record: CreationRecord): Promise<void>
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lingui-creation-history', 1)
    request.onupgradeneeded = () => {
      request.result
        .createObjectStore('creations', { keyPath: ['scope', 'id'] })
        .createIndex('scope', 'scope')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('无法打开创作历史，请检查浏览器存储权限'))
    request.onblocked = () => reject(new Error('创作历史被其他窗口占用，请关闭旧工作台后重试'))
  })
}
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, result: (value: T) => void, fail: (error: Error) => void) => void,
): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('creations', mode)
    let value: T
    let failure = new Error('创作历史保存失败，请检查浏览器存储空间')
    tx.oncomplete = () => {
      db.close()
      resolve(value)
    }
    tx.onabort = tx.onerror = () => {
      db.close()
      reject(failure)
    }
    run(
      tx.objectStore('creations'),
      (result) => {
        value = result
      },
      (error) => {
        failure = error
        tx.abort()
      },
    )
  })
}
export const creationHistoryRepository: CreationHistoryRepository = {
  async list(scope) {
    const records = await transaction<CreationRecord[]>('readonly', (store, result) => {
      const request = store.index('scope').getAll(scope)
      request.onsuccess = () => result(request.result)
    })
    return records
      .map((record) => ({ ...record, ...validateSnapshot(record) }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  async save(record) {
    const safe = { ...record, ...validateSnapshot(record) }
    return transaction('readwrite', (store, result, fail) => {
      const request = store.get([safe.scope, safe.id])
      request.onsuccess = () => {
        const previous = request.result as CreationRecord | undefined
        if ((previous?.revision ?? 0) !== safe.revision)
          return fail(new HistoryConflictError('历史已在其他窗口修改'))
        const saved = { ...safe, revision: safe.revision + 1, updatedAt: new Date().toISOString() }
        store.put(saved)
        result(saved)
      }
    })
  },
  async remove(record) {
    await transaction<void>('readwrite', (store, result, fail) => {
      const request = store.get([record.scope, record.id])
      request.onsuccess = () => {
        if (request.result && request.result.revision !== record.revision)
          return fail(new HistoryConflictError('历史已在其他窗口修改，请刷新列表后重试'))
        store.delete([record.scope, record.id])
        result(undefined)
      }
    })
  },
}
