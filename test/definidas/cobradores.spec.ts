import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { assertSinOverlayDeNext } from '../soporte'

const CONTADOR = /^\d+ cobradores?$/
const VACIO = 'Todavia no hay cobradores. Haz clic en "Nuevo Cobrador" para comenzar.'
const CONFLICTO = 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'

async function valorDeVista(dialog: Locator, etiqueta: string) {
  return (await dialog.getByText(etiqueta, { exact: true }).locator('xpath=..').locator('span').last().innerText()).trim()
}

async function empresaYProyecto(page: Page) {
  await page.locator('tbody tr').first().dblclick()
  const dialog = page.getByRole('dialog')
  const empresa = await valorDeVista(dialog, 'Empresa')
  const proyecto = await valorDeVista(dialog, 'Proyecto')
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  return { empresa, proyecto }
}

async function elegirOpcion(dialog: Locator, indice: number, nombre: string) {
  const trigger = dialog.locator('[data-slot="select-trigger"]').nth(indice)
  const actual = (await trigger.innerText()).replace(/[▼▾]/g, '').replace(/\s+/g, ' ').trim()
  if (actual === nombre) return
  await trigger.click()
  await dialog.page().getByRole('option', { name: nombre, exact: true }).click()
}

async function confirmarSiParece(page: Page, exito: string) {
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Nombres similares encontrados' })
  const ok = page.getByText(exito)
  await expect(aviso.or(ok)).toBeVisible()
  if (await aviso.isVisible()) {
    await aviso.getByRole('button', { name: 'Si, es diferente — Continuar' }).click()
    await expect(aviso).toBeHidden()
  }
  await expect(ok).toBeVisible()
}

async function crearCobrador(page: Page, nombre: string) {
  await page.getByRole('button', { name: 'Nuevo Cobrador' }).click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nuevo Cobrador' }) })
  await dialog.getByLabel('Nombre *').fill(nombre)
  await expect(dialog.getByLabel('Nombre *')).toHaveValue(nombre)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await confirmarSiParece(page, 'Cobrador creado.')
  await expect(dialog).toBeHidden()
}

async function abrirEdicion(page: Page, nombre: string) {
  await page.getByPlaceholder('Buscar cobrador…').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Cobrador' })).toBeVisible()
  await expect(dialog.getByLabel('Nombre *')).toHaveValue(nombre)
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
    await dialog.getByRole('button', { name: 'Close' }).click({ force: true })
    await expect(dialog).toBeHidden()
  }
}

async function eliminarCobrador(page: Page, nombre: string) {
  await cerrarLoAbierto(page)
  await page.getByPlaceholder('Buscar cobrador…').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
  await dialog.getByRole('button', { name: 'Eliminar' }).click()
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Eliminar cobrador' })
  await aviso.getByRole('button', { name: 'Eliminar' }).click()
  await expect(aviso).toBeHidden()
  const ok = page.getByText('Cobrador eliminado.')
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
  const busqueda = page.getByPlaceholder('Buscar cobrador…')
  const criterios: Array<[string, RegExp]> = [
    ['E2E COBRADOR', /E2E COBRADOR \d+/],
    ['KILO NORTE', /KILO NORTE \d+/],
    ['VASO SUR', /VASO SUR \d+/],
  ]
  for (const [prefijo, criterio] of criterios) {
    await busqueda.fill(prefijo)
    for (let i = 0; i < 5; i += 1) {
      const fila = page.locator('tbody tr').filter({ hasText: criterio })
      if ((await fila.count()) === 0) break
      const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
      await eliminarCobrador(page, nombre)
      await busqueda.fill(prefijo)
    }
  }
  await busqueda.fill('')
}

test.beforeEach(async ({ page }) => {
  const response = await page.goto('/dashboard/promesas/cobradores')
  expect(response?.status() ?? 0).toBeLessThan(400)
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { level: 1, name: 'Cobradores' })).toBeVisible()
  await assertSinOverlayDeNext(page)
})

test('una búsqueda sin coincidencias vacía la lista y se puede deshacer', async ({ page }) => {
  const contador = page.getByText(CONTADOR)
  await expect(contador).toBeVisible()
  const antes = (await contador.innerText()).trim()

  const busqueda = page.getByPlaceholder('Buscar cobrador…')
  await busqueda.fill('___sin_coincidencias___')
  await expect(page.getByText('0 cobradores')).toBeVisible()
  await expect(page.getByText('No se encontraron cobradores con ese criterio.')).toBeVisible()

  await busqueda.fill('')
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
  await expect(page.getByText('No se encontraron cobradores con ese criterio.')).toHaveCount(0)
})

test('exportar CSV usa las columnas visibles y no toca la base', async ({ page }) => {
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toBe(`cobradores-${new Date().toISOString().slice(0, 10)}.csv`)

  const ruta = await archivo.path()
  expect(ruta).toBeTruthy()
  const csv = await readFile(ruta as string, 'utf8')
  const encabezado = csv.split('\n')[0] ?? ''
  expect(encabezado).toContain('Codigo')
  expect(encabezado).toContain('Proyecto')
  expect(encabezado).toContain('Nombre')
  expect(encabezado).toContain('Activo')
  expect(encabezado).not.toContain('cuenta')
  expect(encabezado).not.toContain('Empresa')
})

test('nuevo cobrador exige nombre y se cierra sin guardar', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nuevo Cobrador' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')
  await nuevo.click()

  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nuevo Cobrador' }) })
  await expect(dialog.getByLabel('Nombre *')).toHaveValue('')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('El nombre es requerido.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const nombre = dialog.getByLabel('Nombre *')
  await expect(nombre).toHaveAttribute('aria-invalid', 'true')
  await expect(nombre).toBeFocused()
  await expect(page.getByText('Cobrador creado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('ver un cobrador y cancelar la edición no guarda cambios', async ({ page }) => {
  test.skip(await page.getByText(VACIO).isVisible(), 'La cuenta de prueba no tiene cobradores.')

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
  await expect(dialog.getByRole('heading', { name: 'Editar Cobrador' })).toBeVisible()
  await dialog.getByLabel('Nombre *').fill(`${nombre} CAMBIO QUE NO SE GUARDA`)
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(titulo).toBeVisible()
  await expect(page.getByText('Cobrador actualizado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})

test('editar con el nombre vacío marca el campo y no guarda', async ({ page }) => {
  test.skip(await page.getByText(VACIO).isVisible(), 'La cuenta de prueba no tiene cobradores.')

  const fila = page.locator('tbody tr').first()
  const nombre = (await fila.locator('td.font-medium').innerText()).trim()
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await dialog.getByLabel('Nombre *').fill('')
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('El nombre es requerido.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const campo = dialog.getByLabel('Nombre *')
  await expect(campo).toHaveAttribute('aria-invalid', 'true')
  await expect(campo).toBeFocused()
  await expect(page.getByText('Cobrador actualizado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})

test('un nombre parecido avisa y cancelar no guarda', async ({ page }) => {
  test.skip(await page.getByText(VACIO).isVisible(), 'La cuenta de prueba no tiene cobradores.')

  const contador = page.getByText(CONTADOR)
  const antes = (await contador.innerText()).trim()
  const nombre = (await page.locator('tbody tr').first().locator('td.font-medium').innerText()).trim()
  const combo = await empresaYProyecto(page)

  await page.getByRole('button', { name: 'Nuevo Cobrador' }).click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nuevo Cobrador' }) })
  await elegirOpcion(dialog, 0, combo.empresa)
  await elegirOpcion(dialog, 1, combo.proyecto)
  await dialog.getByLabel('Nombre *').fill(nombre)
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  const aviso = page.getByRole('alertdialog')
  await expect(aviso.getByRole('heading', { name: 'Nombres similares encontrados' })).toBeVisible()
  await aviso.getByRole('button', { name: 'Cancelar' }).click()
  await expect(aviso).toBeHidden()
  await expect(page.getByText('Cobrador creado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
})

test('crea un cobrador con nombre único y lo elimina', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nuevo Cobrador' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')
  await limpiar(page)

  const nombre = `E2E COBRADOR ${Date.now()}`
  let creado = false
  try {
    await crearCobrador(page, nombre)
    creado = true
    await page.getByPlaceholder('Buscar cobrador…').fill(nombre)
    await expect(page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })).toHaveCount(1)
    await expect(page.getByText('1 cobrador')).toBeVisible()
    await eliminarCobrador(page, nombre)
    creado = false
    await expect(page.getByText('No se encontraron cobradores con ese criterio.')).toBeVisible()
    await expect(page.getByText('0 cobradores')).toBeVisible()
  } finally {
    if (creado) {
      await eliminarCobrador(page, nombre).catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : String(error)
        throw new Error(`Quedó el cobrador ${nombre}. Bórralo a mano. ${detalle}`)
      })
    }
  }
})

test('dos pestañas editan el mismo cobrador y solo la primera grabación vale', async ({ page }) => {
  test.setTimeout(90_000)
  const nuevo = page.getByRole('button', { name: 'Nuevo Cobrador' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')
  await limpiar(page)

  const marca = Date.now()
  const original = `E2E COBRADOR ${marca}`
  const primero = `KILO NORTE ${marca}`
  const segundo = `VASO SUR ${marca}`
  let creado = false
  const otra = await page.context().newPage()

  try {
    await crearCobrador(page, original)
    creado = true
    const dialogA = await abrirEdicion(page, original)

    await otra.goto('/dashboard/promesas/cobradores')
    await expect(otra).not.toHaveURL(/\/login/)
    await expect(otra.getByRole('heading', { level: 1, name: 'Cobradores' })).toBeVisible()
    const dialogB = await abrirEdicion(otra, original)

    await dialogB.getByLabel('Nombre *').fill(primero)
    await dialogB.getByRole('button', { name: 'Guardar' }).click()
    await confirmarSiParece(otra, 'Cobrador actualizado.')
    await expect(dialogB).toBeHidden()

    await dialogA.getByLabel('Nombre *').fill(segundo)
    await dialogA.getByRole('button', { name: 'Guardar' }).click()
    const aviso = page.getByRole('alertdialog').filter({ hasText: 'Nombres similares encontrados' })
    const error = page.getByText(CONFLICTO)
    await expect(aviso.or(error)).toBeVisible()
    if (await aviso.isVisible()) {
      await aviso.getByRole('button', { name: 'Si, es diferente — Continuar' }).click()
    }
    await expect(error).toBeVisible()
    await expect(dialogA.getByRole('heading', { name: 'Editar Cobrador' })).toBeVisible()
    await expect(page.getByText('Cobrador actualizado.')).toHaveCount(0)

    await dialogA.getByRole('button', { name: 'Close' }).click()
    await expect(dialogA).toBeHidden()
    await page.getByPlaceholder('Buscar cobrador…').fill(primero)
    await expect(page.locator('tbody td.font-medium').filter({ hasText: primero })).toBeVisible()
    await page.getByPlaceholder('Buscar cobrador…').fill(segundo)
    await expect(page.getByText('No se encontraron cobradores con ese criterio.')).toBeVisible()

    await eliminarCobrador(page, primero)
    creado = false
  } finally {
    await otra.close()
    if (creado) {
      await page.getByPlaceholder('Buscar cobrador…').fill(String(marca))
      const fila = page.locator('tbody tr').filter({ hasText: String(marca) })
      if ((await fila.count()) > 0) {
        const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
        await eliminarCobrador(page, nombre).catch((error: unknown) => {
          const detalle = error instanceof Error ? error.message : String(error)
          throw new Error(`Quedó el cobrador ${nombre}. Bórralo a mano. ${detalle}`)
        })
      }
    }
  }
})
