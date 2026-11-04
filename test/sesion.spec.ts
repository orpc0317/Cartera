import { expect, test } from '@playwright/test'

const RUTAS_PROTEGIDAS = [
  '/',
  '/dashboard',
  '/dashboard/home',
  '/dashboard/bancos/bancos',
  '/dashboard/promesas/clientes',
]

for (const ruta of RUTAS_PROTEGIDAS) {
  test(`sin sesión, ${ruta} vuelve al login`, async ({ page }) => {
    await page.goto(ruta)
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Cartera' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
  })
}

test('el login no envía el formulario vacío', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
  await expect(page.getByLabel('Email')).toHaveJSProperty('validity.valueMissing', true)
  await expect(page.getByLabel('Contraseña')).toHaveJSProperty('validity.valueMissing', true)
})

test('el login rechaza un email mal formado', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('no-es-correo')
  await page.getByLabel('Contraseña').fill('secreto')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('Email')).toHaveJSProperty('validity.typeMismatch', true)
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
})

test('un callback inválido se queda en el login', async ({ page }) => {
  await page.goto('/auth/callback?code=no-es-un-codigo&next=https://evil.example')
  await expect(page).toHaveURL(/\/login\?error=callback$/)
  expect(new URL(page.url()).hostname).not.toBe('evil.example')
})
