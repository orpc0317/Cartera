import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { assertSinOverlayDeNext, credencialesDePrueba } from './soporte'

const authFile = path.join(process.cwd(), 'test/.auth/user.json')

test('inicia sesión', async ({ page }) => {
  const { email, password } = credencialesDePrueba()

  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1, name: 'Cartera' })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.waitForFunction(() => {
    const token = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
    return Boolean(token?.value)
  })
  await page.getByRole('button', { name: 'Ingresar' }).click()

  const error = page.locator('p.text-destructive')
  const entro = page.waitForURL(/\/dashboard/).then(() => 'ok' as const)
  const fallo = error.waitFor({ state: 'visible' }).then(() => 'error' as const)
  entro.catch(() => {})
  fallo.catch(() => {})
  if ((await Promise.race([entro, fallo])) === 'error') {
    throw new Error((await error.textContent())?.trim() || 'El login falló.')
  }

  if (await page.getByRole('heading', { name: 'Seleccionar cuenta' }).isVisible()) {
    await page.locator('main button').first().click()
    await page.waitForURL(/\/dashboard/)
  }

  await assertSinOverlayDeNext(page)
  mkdirSync(path.dirname(authFile), { recursive: true })
  await page.context().storageState({ path: authFile })
})
