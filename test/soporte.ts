import { expect, type Page } from '@playwright/test'

const ERROR_OVERLAY = /Recoverable Error|Unhandled Runtime Error|Build Error|Console Error/

export async function assertSinOverlayDeNext(page: Page) {
  const texto = await page.locator('nextjs-portal').evaluateAll((portales) =>
    portales
      .map((nodo) => {
        const root = (nodo as HTMLElement).shadowRoot
        return (root?.textContent ?? nodo.textContent ?? '').replace(/\s+/g, ' ').trim()
      })
      .join('\n'),
  )
  expect(texto, 'El overlay de Next.js mostró un error').not.toMatch(ERROR_OVERLAY)
}

export function credencialesDePrueba() {
  const email = process.env.TEST_LOGIN_USERNAME
  const password = process.env.TEST_LOGIN_PASSWORD
  if (!email || !password) {
    throw new Error('Faltan TEST_LOGIN_USERNAME y TEST_LOGIN_PASSWORD para la pasada de humo.')
  }
  return { email, password }
}
