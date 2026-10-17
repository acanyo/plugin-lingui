import { axiosInstance } from '@halo-dev/api-client'
import { validateFontFamily } from '@lingui/renderer'
import { FontFamilyV1alpha1Api, type FontFamily } from '../api/generated'
import type { ManagedFont } from '../font-library/types'
const api = new FontFamilyV1alpha1Api(undefined, '', axiosInstance)
function decode(resource: FontFamily): ManagedFont {
  return {
    definition: validateFontFamily(JSON.parse(resource.spec.manifest)),
    sourceUrl: resource.spec.sourceUrl,
    versionToken: resource.metadata.version ?? undefined,
  }
}
export function createHaloFontRepository() {
  return {
    async listFonts() {
      const result: ManagedFont[] = []
      for (let page = 1; ; page++) {
        const { data } = await api.listFontFamily({ page, size: 100 })
        result.push(...data.items.filter((item) => !item.metadata.deletionTimestamp).map(decode))
        if (page * 100 >= data.total) break
      }
      return result
    },
    async saveFont(record: ManagedFont) {
      const font = validateFontFamily(record.definition)
      const resource: FontFamily = {
        apiVersion: 'lingui.acanyo.com/v1alpha1',
        kind: 'FontFamily',
        metadata: {
          name: font.id,
          ...(record.versionToken !== undefined ? { version: record.versionToken } : {}),
        },
        spec: {
          displayName: font.name,
          manifest: JSON.stringify(font),
          sourceUrl: record.sourceUrl,
        },
      }
      const { data } =
        record.versionToken !== undefined
          ? await api.updateFontFamily({ name: font.id, fontFamily: resource })
          : await api.createFontFamily({ fontFamily: resource })
      return decode(data)
    },
    async deleteFont(id: string) {
      await api.deleteFontFamily({ name: id })
    },
  }
}
