import { expect, test } from '@playwright/test'
import { assertSinOverlayDeNext } from '../soporte'

test.beforeEach(async ({ page }) => {
  const response = await page.goto('/dashboard/proyectos/proyectos')
  expect(response?.status() ?? 0).toBeLessThan(400)
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeVisible()
  await assertSinOverlayDeNext(page)
})

test('nuevo proyecto marca el nombre vacío en la pestaña General', async ({ page }) => {
  await page.getByRole('button', { name: 'Nuevo Proyecto' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nuevo Proyecto' })
  await expect(dialog.getByRole('tab', { name: 'Monedas' })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('El nombre del proyecto es requerido.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const campo = dialog.getByLabel('Nombre Proyecto *')
  await expect(campo).toBeVisible()
  await expect(campo).toHaveAttribute('aria-invalid', 'true')
  await expect(campo).toBeFocused()
  await expect(page.getByText('Proyecto creado exitosamente.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('editar desde otra pestaña vuelve al campo obligatorio vacío', async ({ page }) => {
  const vacio = page.getByText('Todavia no hay proyectos. Haz clic en "Nuevo Proyecto" para comenzar.')
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene proyectos.')

  const fila = page.locator('tbody tr').first()
  const nombre = (await fila.locator('td.font-medium').innerText()).trim()
  expect(nombre.length).toBeGreaterThan(0)
  await fila.dblclick()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('heading', { name: nombre, exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Proyecto' })).toBeVisible()
  await dialog.getByLabel('Nombre Proyecto *').fill('')
  await dialog.getByRole('tab', { name: 'Monedas' }).click()
  await expect(dialog.getByRole('tab', { name: 'Monedas', selected: true })).toBeVisible()

  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('El nombre del proyecto es requerido.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const campo = dialog.getByLabel('Nombre Proyecto *')
  await expect(campo).toBeVisible()
  await expect(campo).toHaveAttribute('aria-invalid', 'true')
  await expect(campo).toBeFocused()
  await expect(page.getByText('Proyecto actualizado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})
