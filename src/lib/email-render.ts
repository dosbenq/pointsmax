import type { ReactElement } from 'react'
import { render } from '@react-email/render'

export async function renderEmail(element: ReactElement): Promise<string> {
  return render(element)
}
