import { expect, test } from '@playwright/test'
import { assertSinOverlayDeNext } from './soporte'

test('el login abre sin error', async ({ page }) => {
  const response = await page.goto('/login')
  expect(response?.status() ?? 0).toBeLessThan(400)
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { level: 1, name: 'Cartera' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Contraseña')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
  await assertSinOverlayDeNext(page)
})
