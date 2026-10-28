import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { assertSinOverlayDeNext } from '../soporte'

const CONTADOR = /^\d+ series? de recibos$/
const VACIO = 'Todavia no hay series de recibos. Haz clic en "Nueva Serie" para comenzar.'
const CONFLICTO = 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'
const BUSCAR = 'Buscar series...'

async function valorDeVista(dialog: Locator, etiqueta: string) {
  return (await dialog.getByText(etiqueta, { exact: true }).locator('xpath=..').locator('span').last().innerText()).trim()
}

function textoDelTrigger(texto: string) {
  return texto.replace(/[▼▾]/g, '').replace(/\s+/g, ' ').trim()
}

async function asegurarProyecto(dialog: Locator) {
  const trigger = dialog.locator('#proyecto')
  const texto = textoDelTrigger(await trigger.innerText())
  if (texto && texto !== 'Selecciona proyecto') return
  await trigger.click()
  const opcion = dialog.page().getByRole('option').first()
  await expect(opcion, 'La empresa preseleccionada no tiene proyectos.').toBeVisible()
  await opcion.click()
}

async function crearSerie(page: Page, serie: string) {
  await page.getByRole('button', { name: 'Nueva Serie' }).click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nueva Serie de Recibos' }) })
  await asegurarProyecto(dialog)
  await dialog.getByLabel('Serie *').fill(serie)
  await expect(dialog.getByLabel('Serie *')).toHaveValue(serie)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Serie creada.')).toBeVisible()
  await expect(dialog).toBeHidden()
}

async function abrirEdicion(page: Page, serie: string) {
  await page.getByPlaceholder(BUSCAR).fill(serie)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(serie, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Serie de Recibos' })).toBeVisible()
  await expect(dialog.getByLabel('Serie *')).toHaveValue(serie)
  return dialog
}

async function cerrarLoAbierto(page: Page) {
  const aviso = page.getByRole('alertdialog')
  if (await aviso.isVisible().catch(() => false)) {
    await aviso.getByRole('button', { name: 'Cancelar' }).click()
    await expect(aviso).toBeHidden()
  }
  const dialog = page.getByRole('dialog')
  if (await dialog.isVisible().catch(() => false)) {
    const cancelar = dialog.getByRole('button', { name: 'Cancelar' })
    if (await cancelar.isVisible().catch(() => false)) await cancelar.click()
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole('button', { name: 'Close' }).click({ force: true })
      await expect(dialog).toBeHidden()
    }
  }
}

async function eliminarSerie(page: Page, serie: string) {
  await cerrarLoAbierto(page)
  await page.getByPlaceholder(BUSCAR).fill(serie)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(serie, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: serie, exact: true }) })
  await dialog.getByRole('button', { name: 'Eliminar' }).click()
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Eliminar serie de recibos' })
  await aviso.getByRole('button', { name: 'Eliminar' }).click()
  await expect(aviso).toBeHidden()
  const ok = page.getByText('Serie eliminada.')
  try {
    await expect(ok).toBeVisible()
  } catch (error) {
    const detalle = (await page.locator('[data-sonner-toast][data-type="error"]').last().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
    throw new Error(detalle || (error instanceof Error ? error.message : String(error)))
  }
  await expect(fila).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click({ force: true })
  await expect(dialog).toBeHidden()
}

async function limpiar(page: Page) {
  const busqueda = page.getByPlaceholder(BUSCAR)
  await busqueda.fill('E2E')
  for (let i = 0; i < 5; i += 1) {
    const fila = page.locator('tbody tr').filter({ hasText: /E2E\d+/ })
    if ((await fila.count()) === 0) break
    const serie = (await fila.first().locator('td').first().innerText()).trim()
    await eliminarSerie(page, serie)
    await busqueda.fill('E2E')
  }
  await busqueda.fill('')
}

test.beforeEach(async ({ page }) => {
  const response = await page.goto('/dashboard/cuentas-cobrar/series-recibos')
  expect(response?.status() ?? 0).toBeLessThan(400)
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { level: 1, name: 'Series de Recibos' })).toBeVisible()
  await assertSinOverlayDeNext(page)
})

test('una búsqueda sin coincidencias vacía la lista y se puede deshacer', async ({ page }) => {
  const contador = page.getByText(CONTADOR)
  await expect(contador).toBeVisible()
  const antes = (await contador.innerText()).trim()

  const busqueda = page.getByPlaceholder(BUSCAR)
  await busqueda.fill('___sin_coincidencias___')
  await expect(page.getByText('0 series de recibos')).toBeVisible()
  await expect(page.getByText('No se encontraron series con ese criterio.')).toBeVisible()

  await busqueda.fill('')
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
  await expect(page.getByText('No se encontraron series con ese criterio.')).toHaveCount(0)
})

test('exportar CSV usa las columnas visibles y no toca la base', async ({ page }) => {
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toBe(`series-recibos-${new Date().toISOString().slice(0, 10)}.csv`)

  const ruta = await archivo.path()
  expect(ruta).toBeTruthy()
  const csv = await readFile(ruta as string, 'utf8')
  const encabezado = csv.split('\n')[0] ?? ''
  expect(encabezado).toContain('Serie')
  expect(encabezado).toContain('Proyecto')
  expect(encabezado).toContain('Automatico')
  expect(encabezado).toContain('Predeterminado')
  expect(encabezado).toContain('Formato')
  expect(encabezado).toContain('Serie Factura')
  expect(encabezado).toContain('Activo')
  expect(encabezado).not.toContain('cuenta')
  expect(encabezado).not.toContain('Empresa')
  expect(encabezado).not.toContain('Correlativo')
  expect(encabezado).not.toContain('Dias Fecha')
})

test('nueva serie exige el codigo y se cierra sin guardar', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nueva Serie' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')
  await nuevo.click()

  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nueva Serie de Recibos' }) })
  await expect(dialog.getByLabel('Serie *')).toHaveValue('')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('La serie es requerida.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const serie = dialog.getByLabel('Serie *')
  await expect(serie).toHaveAttribute('aria-invalid', 'true')
  await expect(serie).toBeFocused()
  await expect(page.getByText('Serie creada.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click({ force: true })
  await expect(dialog).toBeHidden()
})

test('ver una serie y cancelar la edición no guarda cambios', async ({ page }) => {
  test.skip(await page.getByText(VACIO).isVisible(), 'La cuenta de prueba no tiene series de recibos.')

  const fila = page.locator('tbody tr').first()
  const serie = (await fila.locator('td').first().innerText()).trim()
  expect(serie.length).toBeGreaterThan(0)
  await fila.dblclick()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: serie, exact: true })).toBeVisible()
  await expect(dialog.getByText('IDENTIFICACION')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Historial' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Editar' })).toBeVisible()

  const formatoAntes = await valorDeVista(dialog, 'Formato')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Serie de Recibos' })).toBeVisible()
  const formato = dialog.getByLabel('Formato')
  const distinto = formatoAntes === '4' ? '5' : '4'
  await formato.fill(distinto)
  await expect(formato).toHaveValue(distinto)
  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  await expect(dialog.getByRole('heading', { name: serie, exact: true })).toBeVisible()
  expect(await valorDeVista(dialog, 'Formato')).toBe(formatoAntes)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td').first()).toHaveText(serie)
})

test('editar deja la serie bloqueada y no se puede vaciar', async ({ page }) => {
  test.skip(await page.getByText(VACIO).isVisible(), 'La cuenta de prueba no tiene series de recibos.')

  const fila = page.locator('tbody tr').first()
  const serie = (await fila.locator('td').first().innerText()).trim()
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Serie de Recibos' })).toBeVisible()

  const campo = dialog.getByLabel('Serie *')
  await expect(campo).toBeDisabled()
  await expect(campo).toHaveValue(serie)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('La serie es requerida.')).toHaveCount(0)
  await expect(page.getByText('Serie actualizada.')).toHaveCount(0)
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td').first()).toHaveText(serie)
})

test('crea una serie con codigo único y la elimina', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nueva Serie' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')
  await limpiar(page)

  const serie = `E2E${Date.now()}`
  let creada = false
  try {
    await crearSerie(page, serie)
    creada = true
    await page.getByPlaceholder(BUSCAR).fill(serie)
    await expect(page.locator('tbody tr').filter({ has: page.getByText(serie, { exact: true }) })).toHaveCount(1)
    await expect(page.getByText('1 serie de recibos')).toBeVisible()
    await eliminarSerie(page, serie)
    creada = false
    await expect(page.getByText('No se encontraron series con ese criterio.')).toBeVisible()
    await expect(page.getByText('0 series de recibos')).toBeVisible()
  } finally {
    if (creada) {
      await eliminarSerie(page, serie).catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : String(error)
        throw new Error(`Quedó la serie ${serie}. Bórrala a mano. ${detalle}`)
      })
    }
  }
})

test('dos pestañas editan la misma serie y solo la primera grabación vale', async ({ page }) => {
  test.setTimeout(90_000)
  const nuevo = page.getByRole('button', { name: 'Nueva Serie' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')
  await limpiar(page)

  const serie = `E2E${Date.now()}`
  let creada = false
  const otra = await page.context().newPage()

  try {
    await crearSerie(page, serie)
    creada = true
    const dialogA = await abrirEdicion(page, serie)

    await otra.goto('/dashboard/cuentas-cobrar/series-recibos')
    await expect(otra).not.toHaveURL(/\/login/)
    await expect(otra.getByRole('heading', { level: 1, name: 'Series de Recibos' })).toBeVisible()
    const dialogB = await abrirEdicion(otra, serie)

    await dialogB.getByLabel('Formato').fill('8')
    await expect(dialogB.getByLabel('Formato')).toHaveValue('8')
    await dialogB.getByRole('button', { name: 'Guardar' }).click()
    await expect(otra.getByText('Serie actualizada.')).toBeVisible()
    await expect(dialogB).toBeHidden()

    await dialogA.getByLabel('Formato').fill('3')
    await expect(dialogA.getByLabel('Formato')).toHaveValue('3')
    await dialogA.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText(CONFLICTO)).toBeVisible()
    await expect(dialogA.getByRole('heading', { name: 'Editar Serie de Recibos' })).toBeVisible()
    await expect(page.getByText('Serie actualizada.')).toHaveCount(0)

    await dialogA.getByRole('button', { name: 'Close' }).click({ force: true })
    await expect(dialogA).toBeHidden()
    await page.getByPlaceholder(BUSCAR).fill(serie)
    const fila = page.locator('tbody tr').filter({ has: page.getByText(serie, { exact: true }) })
    await expect(fila).toHaveCount(1)
    await fila.dblclick()
    const vista = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: serie, exact: true }) })
    expect(await valorDeVista(vista, 'Formato')).toBe('8')
    await vista.getByRole('button', { name: 'Close' }).click({ force: true })
    await expect(vista).toBeHidden()

    await eliminarSerie(page, serie)
    creada = false
  } finally {
    await otra.close()
    if (creada) {
      await eliminarSerie(page, serie).catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : String(error)
        throw new Error(`Quedó la serie ${serie}. Bórrala a mano. ${detalle}`)
      })
    }
  }
})
