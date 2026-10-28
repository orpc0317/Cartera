import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { assertSinOverlayDeNext } from '../soporte'

test.beforeEach(async ({ page }) => {
  const response = await page.goto('/dashboard/bancos/bancos')
  expect(response?.status() ?? 0).toBeLessThan(400)
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { level: 1, name: 'Bancos' })).toBeVisible()
  await assertSinOverlayDeNext(page)
})

test('una búsqueda sin coincidencias vacía la lista y se puede deshacer', async ({ page }) => {
  const contador = page.getByText(/^\d+ bancos?$/)
  await expect(contador).toBeVisible()
  const antes = (await contador.innerText()).trim()

  const busqueda = page.getByPlaceholder('Buscar bancos...')
  await busqueda.fill('___sin_coincidencias___')
  await expect(page.getByText('0 bancos')).toBeVisible()
  await expect(page.getByText('Sin resultados para esa busqueda.')).toBeVisible()

  await busqueda.fill('')
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
  await expect(page.getByText('Sin resultados para esa busqueda.')).toHaveCount(0)
})

test('exportar CSV usa las columnas visibles y no toca la base', async ({ page }) => {
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toBe(`bancos-${new Date().toISOString().slice(0, 10)}.csv`)

  const ruta = await archivo.path()
  expect(ruta).toBeTruthy()
  const csv = await readFile(ruta as string, 'utf8')
  const encabezado = csv.split('\n')[0] ?? ''
  expect(encabezado).toContain('Codigo')
  expect(encabezado).toContain('Nombre')
  expect(encabezado).not.toContain('cuenta')
})

test('nuevo banco exige nombre y se cierra sin guardar', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nuevo Banco' })
  await expect(nuevo).toBeEnabled()
  await nuevo.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Nuevo Banco', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Nombre *')).toHaveValue('')

  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('El nombre es requerido.')).toBeVisible()
  await expect(dialog.getByText('Nuevo Banco', { exact: true })).toBeVisible()

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Bancos' })).toBeVisible()
})

test('ver un banco y cancelar la edición no guarda cambios', async ({ page }) => {
  const vacio = page.getByText('No hay bancos registrados aun.')
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene bancos.')

  const fila = page.locator('tbody tr').first()
  const nombre = (await fila.locator('td.font-medium').innerText()).trim()
  expect(nombre.length).toBeGreaterThan(0)
  await fila.dblclick()

  const dialog = page.getByRole('dialog')
  const titulo = dialog.getByRole('heading', { name: nombre, exact: true })
  await expect(titulo).toBeVisible()
  await expect(dialog.getByText('IDENTIFICACION')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Historial' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Editar' })).toBeVisible()

  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Banco' })).toBeVisible()
  const campo = dialog.getByLabel('Nombre *')
  await expect(campo).toHaveValue(nombre)
  await campo.fill(`${nombre} CAMBIO QUE NO SE GUARDA`)

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(titulo).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Editar Banco' })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})
