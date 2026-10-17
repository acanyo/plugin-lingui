import { pureTheme } from '@lingui/renderer'
import { templateInstance, type TemplateRecord } from '../component-library/types'
import { createSubmission, type SubmissionDraft } from './submission'

/** Capture the saved project without opening or changing the active editor. */
export function projectSubmission(project: TemplateRecord, author = ''): SubmissionDraft {
  return {
    ...createSubmission(templateInstance(project, pureTheme), project.revisions.at(-1)?.provenance),
    description: project.description,
    category: project.category,
    author,
  }
}
