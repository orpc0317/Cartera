import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { assertSinOverlayDeNext } from '../soporte'

const CONTADOR = /^(?:0 lotes|\d+\u2013\d+ de \d+ lotes?)$/

async function crearLoteDePrueba(page: Page, codigo: string) {
  await page.getByRole('button', { name: 'Nuevo Lote' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nuevo Lote' })
  await dialog.getByPlaceholder('Ej: L-001').fill(codigo)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  const ok = page.getByText('Lote creado.')
  const fallo = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(ok.or(fallo)).toBeVisible()
  if (!(await ok.isVisible())) {
    throw new Error((await fallo.first().innerText()).replace(/\s+/g, ' ').trim())
  }
  await expect(dialog).toBeHidden()
}

async function abrirEdicionDeLote(page: Page, codigo: string) {
  await page.getByPlaceholder('Buscar lotes...').fill(codigo)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(codigo, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Lote' })).toBeVisible()
  return dialog
}

async function eliminarLote(page: Page, codigo: string) {
  await page.getByPlaceholder('Buscar lotes...').fill(codigo)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(codigo, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: `Lote ${codigo}`, exact: true }) })
  await dialog.getByRole('button', { name: 'Eliminar' }).click()
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Eliminar lote' })
  await aviso.getByRole('button', { name: 'Eliminar' }).click()
  const ok = page.getByText('Lote eliminado.')
  const fallo = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(ok.or(fallo)).toBeVisible()
  if (!(await ok.isVisible())) {
    throw new Error((await fallo.first().innerText()).replace(/\s+/g, ' ').trim())
  }
  await expect(fila).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click({ force: true })
  await expect(dialog).toBeHidden()
}

async function limpiarLotesDePrueba(page: Page) {
  const busqueda = page.getByPlaceholder('Buscar lotes...')
  await busqueda.fill('E2E')
  for (let i = 0; i < 5; i += 1) {
    const fila = page.locator('tbody tr').filter({ hasText: /E2E\d+/ })
    if ((await fila.count()) === 0) break
    const codigo = (await fila.first().locator('td').first().innerText()).trim()
    const abierto = page.getByRole('dialog')
    if (await abierto.isVisible().catch(() => false)) {
      await abierto.getByRole('button', { name: 'Close' }).click({ force: true }).catch(() => undefined)
    }
    await eliminarLote(page, codigo)
    await busqueda.fill('E2E')
  }
  await busqueda.fill('')
}

function norteEnVista(dialog: Locator) {
  return dialog.getByText('Norte', { exact: true }).locator('xpath=..').locator('span').last()
}

test.beforeEach(async ({ page }) => {
  const response = await page.goto('/dashboard/proyectos/lotes')
  expect(response?.status() ?? 0).toBeLessThan(400)
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { level: 1, name: 'Lotes' })).toBeVisible()
  await assertSinOverlayDeNext(page)
})

test('una búsqueda sin coincidencias vacía la lista y se puede deshacer', async ({ page }) => {
  const contador = page.getByText(CONTADOR)
  await expect(contador).toBeVisible()
  const antes = (await contador.innerText()).trim()

  const busqueda = page.getByPlaceholder('Buscar lotes...')
  await busqueda.fill('___sin_coincidencias___')
  await expect(page.getByText('0 lotes')).toBeVisible()
  await expect(page.getByText('No se encontraron lotes con ese criterio.')).toBeVisible()

  await busqueda.fill('')
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
  await expect(page.getByText('No se encontraron lotes con ese criterio.')).toHaveCount(0)
})

test('exportar CSV usa las columnas visibles y no toca la base', async ({ page }) => {
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toBe(`lotes-${new Date().toISOString().slice(0, 10)}.csv`)

  const ruta = await archivo.path()
  expect(ruta).toBeTruthy()
  const csv = await readFile(ruta as string, 'utf8')
  const encabezado = csv.split('\n')[0] ?? ''
  expect(encabezado).toContain('Codigo')
  expect(encabezado).toContain('Proyecto')
  expect(encabezado).toContain('Fase')
  expect(encabezado).toContain('Manzana')
  expect(encabezado).toContain('Moneda')
  expect(encabezado).toContain('Precio')
  expect(encabezado).toContain('Extension')
  expect(encabezado).not.toContain('cuenta')
  expect(encabezado).not.toContain('Empresa')
  expect(encabezado).not.toContain('Estado')
  expect(encabezado).not.toContain('Finca')
})

test('ver un lote y cancelar la edición no guarda cambios', async ({ page }) => {
  const vacio = page.getByText('Todavia no hay lotes. Haz clic en "Nuevo Lote" para comenzar.')
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene lotes.')

  const fila = page.locator('tbody tr').first()
  const codigo = (await fila.locator('td').first().innerText()).trim()
  expect(codigo.length).toBeGreaterThan(0)
  await fila.dblclick()

  const dialog = page.getByRole('dialog')
  const titulo = dialog.getByRole('heading', { name: `Lote ${codigo}`, exact: true })
  await expect(titulo).toBeVisible()
  await expect(dialog.getByText('IDENTIFICACION')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Historial' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Editar' })).toBeVisible()
  const norteAntes = (await norteEnVista(dialog).innerText()).trim()

  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Lote' })).toBeVisible()
  await dialog.getByPlaceholder('Colindancia norte').fill('NORTE QUE NO SE GUARDA')

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(titulo).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Editar Lote' })).toHaveCount(0)
  await expect(norteEnVista(dialog)).toHaveText(norteAntes)
  await expect(page.getByText('Lote actualizado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td').first()).toHaveText(codigo)
})

test('crea un lote con código único y lo elimina', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nuevo Lote' })
  await expect(nuevo).toBeVisible()

  await limpiarLotesDePrueba(page)

  const codigo = `E2E${Date.now()}`
  let creado = false
  try {
    await crearLoteDePrueba(page, codigo)
    creado = true

    await page.getByPlaceholder('Buscar lotes...').fill(codigo)
    await expect(page.locator('tbody tr').filter({ has: page.getByText(codigo, { exact: true }) })).toHaveCount(1)
    await expect(page.getByText('1\u20131 de 1 lote')).toBeVisible()

    await eliminarLote(page, codigo)
    creado = false
    await expect(page.getByText('No se encontraron lotes con ese criterio.')).toBeVisible()
    await expect(page.getByText('0 lotes')).toBeVisible()
  } finally {
    if (creado) {
      await eliminarLote(page, codigo).catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : String(error)
        throw new Error(`Quedó el lote ${codigo}. Bórralo a mano. ${detalle}`)
      })
    }
  }
})

test('dos pestañas editan el mismo lote y solo la primera grabación vale', async ({ page }) => {
  test.setTimeout(90_000)
  const nuevo = page.getByRole('button', { name: 'Nuevo Lote' })
  await expect(nuevo).toBeVisible()

  await limpiarLotesDePrueba(page)
  const codigo = `E2E${Date.now()}`
  const conflicto = 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'
  let creado = false
  const otra = await page.context().newPage()

  try {
    await crearLoteDePrueba(page, codigo)
    creado = true

    const dialogA = await abrirEdicionDeLote(page, codigo)

    await otra.goto('/dashboard/proyectos/lotes')
    await expect(otra).not.toHaveURL(/\/login/)
    await expect(otra.getByRole('heading', { level: 1, name: 'Lotes' })).toBeVisible()
    const dialogB = await abrirEdicionDeLote(otra, codigo)

    await dialogB.getByPlaceholder('Colindancia norte').fill('KILO NORTE')
    await dialogB.getByRole('button', { name: 'Guardar' }).click()
    await expect(otra.getByText('Lote actualizado.')).toBeVisible()
    await expect(dialogB.getByRole('heading', { name: `Lote ${codigo}`, exact: true })).toBeVisible()

    await dialogA.getByPlaceholder('Colindancia norte').fill('VASO SUR')
    await dialogA.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText(conflicto)).toBeVisible()
    await expect(dialogA.getByRole('heading', { name: 'Editar Lote' })).toBeVisible()
    await expect(page.getByText('Lote actualizado.')).toHaveCount(0)

    await dialogA.getByRole('button', { name: 'Close' }).click()
    await expect(dialogA).toBeHidden()
    await dialogB.getByRole('button', { name: 'Close' }).click()
    await expect(dialogB).toBeHidden()

    await otra.getByPlaceholder('Buscar lotes...').fill(codigo)
    await otra.locator('tbody tr').filter({ has: otra.getByText(codigo, { exact: true }) }).dblclick()
    const visto = otra.getByRole('dialog')
    await expect(visto.getByRole('heading', { name: `Lote ${codigo}`, exact: true })).toBeVisible()
    await expect(norteEnVista(visto)).toHaveText('KILO NORTE')
    await visto.getByRole('button', { name: 'Close' }).click()

    await eliminarLote(page, codigo)
    creado = false
  } finally {
    await otra.close()
    if (creado) {
      const abierto = page.getByRole('dialog')
      if (await abierto.isVisible().catch(() => false)) {
        await abierto.getByRole('button', { name: 'Close' }).click({ force: true }).catch(() => undefined)
      }
      await eliminarLote(page, codigo).catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : String(error)
        throw new Error(`Quedó el lote ${codigo}. Bórralo a mano. ${detalle}`)
      })
    }
  }
})
