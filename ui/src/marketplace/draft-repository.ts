import { validateSubmission, type SubmissionDraft } from './submission'

/** Browser drafts stay independent from remotely submitted immutable snapshots. */
export interface SubmissionRepository {
  list(): Promise<SubmissionDraft[]>
  save(draft: SubmissionDraft): Promise<SubmissionDraft>
  remove(id: string, revision: number): Promise<void>
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lingui-submission-drafts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('无法打开草稿存储，请检查浏览器存储权限'))
  })
}
async function transact<T>(
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore,
    result: (value: T) => void,
    fail: (message: string) => void,
  ) => void,
): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', mode)
    let value: T,
      failure = '草稿保存失败，请检查浏览器存储空间'
    transaction.oncomplete = () => {
      database.close()
      resolve(value)
    }
    transaction.onabort = transaction.onerror = () => {
      database.close()
      reject(new Error(failure))
    }
    operation(
      transaction.objectStore('drafts'),
      (result) => {
        value = result
      },
      (message) => {
        failure = message
        transaction.abort()
      },
    )
  })
}
export const localSubmissionRepository: SubmissionRepository = {
  async list() {
    const drafts = await transact<SubmissionDraft[]>('readonly', (store, result) => {
      const request = store.getAll()
      request.onsuccess = () => result(request.result)
    })
    return drafts
      .map((draft) => validateSubmission(draft))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  async save(draft) {
    const safe = JSON.parse(JSON.stringify(validateSubmission(draft))) as SubmissionDraft
    return transact('readwrite', (store, result, fail) => {
      const request = store.get(safe.id)
      request.onsuccess = () => {
        const previous = request.result as SubmissionDraft | undefined
        if ((previous?.revision ?? 0) !== safe.revision)
          return fail('草稿已在其他窗口修改，请关闭编辑器并刷新草稿列表')
        const saved = { ...safe, revision: safe.revision + 1, updatedAt: new Date().toISOString() }
        store.put(saved)
        result(saved)
      }
    })
  },
  async remove(id, revision) {
    await transact<void>('readwrite', (store, result, fail) => {
      const request = store.get(id)
      request.onsuccess = () => {
        if (request.result && request.result.revision !== revision)
          return fail('草稿已在其他窗口修改，请刷新后重试')
        store.delete(id)
        result(undefined)
      }
    })
  },
}
