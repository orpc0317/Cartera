import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { assertSinOverlayDeNext } from '../soporte'

async function guardarAunqueParezca(page: Page, exito: string) {
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Nombres similares encontrados' })
  const ok = page.getByText(exito)
  await expect(aviso.or(ok)).toBeVisible()
  if (await aviso.isVisible()) {
    await aviso.getByRole('button', { name: 'Si, es diferente — Continuar' }).click()
    await expect(aviso).toBeHidden()
  }
  await expect(ok).toBeVisible()
}

async function crearFaseDePrueba(page: Page, nombre: string) {
  await page.getByRole('button', { name: 'Nueva Fase' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nueva Fase' })
  await dialog.getByLabel('Nombre *').fill(nombre)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await guardarAunqueParezca(page, 'Fase creada.')
  await expect(dialog).toBeHidden()
}

async function abrirEdicionDeFase(page: Page, nombre: string) {
  await page.getByPlaceholder('Buscar fases...').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Fase' })).toBeVisible()
  await expect(dialog.getByLabel('Nombre *')).toHaveValue(nombre)
  return dialog
}

async function eliminarFase(page: Page, nombre: string) {
  await page.getByPlaceholder('Buscar fases...').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
  await dialog.getByRole('button', { name: 'Eliminar' }).click()
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Eliminar fase' })
  await aviso.getByRole('button', { name: 'Eliminar' }).click()
  const ok = page.getByText('Fase eliminada.')
  const fallo = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(ok.or(fallo)).toBeVisible()
  if (!(await ok.isVisible())) {
    throw new Error((await fallo.first().innerText()).replace(/\s+/g, ' ').trim())
  }
  await expect(fila).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click({ force: true })
  await expect(dialog).toBeHidden()
}

async function limpiarFasesDePrueba(page: Page) {
  const busqueda = page.getByPlaceholder('Buscar fases...')
  for (const prefijo of ['E2E FASE', 'KILO NORTE', 'VASO SUR']) {
    await busqueda.fill(prefijo)
    for (let i = 0; i < 5; i += 1) {
      const fila = page.locator('tbody tr').filter({ hasText: new RegExp(`${prefijo} \\d+`) })
      if ((await fila.count()) === 0) break
      const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
      const abierto = page.getByRole('dialog')
      if (await abierto.isVisible().catch(() => false)) {
        await abierto.getByRole('button', { name: 'Close' }).click({ force: true }).catch(() => undefined)
      }
      await eliminarFase(page, nombre)
    }
  }
  await busqueda.fill('')
}

test.beforeEach(async ({ page }) => {
  const response = await page.goto('/dashboard/proyectos/fases')
  expect(response?.status() ?? 0).toBeLessThan(400)
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { level: 1, name: 'Fases' })).toBeVisible()
  await assertSinOverlayDeNext(page)
})

test('una búsqueda sin coincidencias vacía la lista y se puede deshacer', async ({ page }) => {
  const contador = page.getByText(/^\d+ fases?$/)
  await expect(contador).toBeVisible()
  const antes = (await contador.innerText()).trim()

  const busqueda = page.getByPlaceholder('Buscar fases...')
  await busqueda.fill('___sin_coincidencias___')
  await expect(page.getByText('0 fases')).toBeVisible()
  await expect(page.getByText('No se encontraron fases con ese criterio.')).toBeVisible()

  await busqueda.fill('')
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
  await expect(page.getByText('No se encontraron fases con ese criterio.')).toHaveCount(0)
})

test('exportar CSV usa las columnas visibles y no toca la base', async ({ page }) => {
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toBe(`fases-${new Date().toISOString().slice(0, 10)}.csv`)

  const ruta = await archivo.path()
  expect(ruta).toBeTruthy()
  const csv = await readFile(ruta as string, 'utf8')
  const encabezado = csv.split('\n')[0] ?? ''
  expect(encabezado).toContain('Codigo')
  expect(encabezado).toContain('Proyecto')
  expect(encabezado).toContain('Nombre')
  expect(encabezado).toContain('Medida')
  expect(encabezado).not.toContain('cuenta')
  expect(encabezado).not.toContain('Empresa')
})

test('nueva fase exige nombre y se cierra sin guardar', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nueva Fase' })
  await expect(nuevo).toBeEnabled()
  await nuevo.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Nueva Fase', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Nombre *')).toHaveValue('')

  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('El nombre es requerido.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const nombre = dialog.getByLabel('Nombre *')
  await expect(nombre).toBeVisible()
  await expect(nombre).toHaveAttribute('aria-invalid', 'true')
  await expect(nombre).toBeFocused()
  await expect(dialog.getByText('Nueva Fase', { exact: true })).toBeVisible()
  await expect(page.getByText('Fase creada.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Fases' })).toBeVisible()
})

test('ver una fase y cancelar la edición no guarda cambios', async ({ page }) => {
  const vacio = page.getByText('Todavia no hay fases. Haz clic en "Nueva Fase" para comenzar.')
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene fases.')

  const fila = page.locator('tbody tr').first()
  const nombre = (await fila.locator('td.font-medium').innerText()).trim()
  expect(nombre.length).toBeGreaterThan(0)
  await fila.dblclick()

  const dialog = page.getByRole('dialog')
  const titulo = dialog.getByRole('heading', { name: nombre, exact: true })
  await expect(titulo).toBeVisible()
  await expect(dialog.getByText('Identificacion')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Historial' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Editar' })).toBeVisible()

  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Fase' })).toBeVisible()
  const campo = dialog.getByLabel('Nombre *')
  await expect(campo).toHaveValue(nombre)
  await campo.fill(`${nombre} CAMBIO QUE NO SE GUARDA`)

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(titulo).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Editar Fase' })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})

test('un nombre parecido avisa y cancelar no guarda', async ({ page }) => {
  const vacio = page.getByText('Todavia no hay fases. Haz clic en "Nueva Fase" para comenzar.')
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene fases.')

  const contador = page.getByText(/^\d+ fases?$/)
  const antes = (await contador.innerText()).trim()
  const fila = page.locator('tbody tr').first()
  const proyecto = (await fila.locator('td').nth(1).innerText()).replace(/\s+/g, ' ').trim()
  const nombre = (await fila.locator('td.font-medium').innerText()).trim()
  expect(nombre.length).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Nueva Fase' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nueva Fase' })
  const proyectoTrigger = dialog.locator('#proyecto')
  const proyectoActual = (await proyectoTrigger.innerText()).replace(/\s+/g, ' ').trim()
  if (proyectoActual !== proyecto) {
    await proyectoTrigger.click()
    await page.getByRole('option', { name: proyecto, exact: true }).click()
  }
  await dialog.getByLabel('Nombre *').fill(nombre)
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  const aviso = page.getByRole('alertdialog')
  await expect(aviso.getByRole('heading', { name: 'Nombres similares encontrados' })).toBeVisible()
  await aviso.getByRole('button', { name: 'Cancelar' }).click()
  await expect(aviso).toBeHidden()
  await expect(page.getByText('Fase creada.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
})

test('crea una fase con nombre único y la elimina', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nueva Fase' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')

  await limpiarFasesDePrueba(page)

  const nombre = `E2E FASE ${Date.now()}`
  let creada = false
  try {
    await crearFaseDePrueba(page, nombre)
    creada = true

    await page.getByPlaceholder('Buscar fases...').fill(nombre)
    await expect(page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })).toHaveCount(1)
    await expect(page.getByText('1 fase')).toBeVisible()

    await eliminarFase(page, nombre)
    creada = false
    await expect(page.getByText('No se encontraron fases con ese criterio.')).toBeVisible()
    await expect(page.getByText('0 fases')).toBeVisible()
  } finally {
    if (creada) {
      await eliminarFase(page, nombre).catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : String(error)
        throw new Error(`Quedó la fase ${nombre}. Bórrala a mano. ${detalle}`)
      })
    }
  }
})

test('editar una fase con el nombre vacío marca el campo en General', async ({ page }) => {
  const vacio = page.getByText('Todavia no hay fases. Haz clic en "Nueva Fase" para comenzar.')
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene fases.')

  const fila = page.locator('tbody tr').first()
  const nombre = (await fila.locator('td.font-medium').innerText()).trim()
  await fila.dblclick()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Fase' })).toBeVisible()
  await dialog.getByLabel('Nombre *').fill('')
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('El nombre es requerido.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const campo = dialog.getByLabel('Nombre *')
  await expect(campo).toHaveAttribute('aria-invalid', 'true')
  await expect(campo).toBeFocused()
  await expect(page.getByText('Fase actualizada.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})

test('dos pestañas editan la misma fase y solo la primera grabación vale', async ({ page }) => {
  test.setTimeout(90_000)
  const nuevo = page.getByRole('button', { name: 'Nueva Fase' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')

  await limpiarFasesDePrueba(page)
  const marca = Date.now()
  const original = `E2E FASE ${marca}`
  const primero = `KILO NORTE ${marca}`
  const segundo = `VASO SUR ${marca}`
  const conflicto = 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'
  let creada = false
  const otra = await page.context().newPage()

  try {
    await crearFaseDePrueba(page, original)
    creada = true

    const dialogA = await abrirEdicionDeFase(page, original)

    await otra.goto('/dashboard/proyectos/fases')
    await expect(otra).not.toHaveURL(/\/login/)
    await expect(otra.getByRole('heading', { level: 1, name: 'Fases' })).toBeVisible()
    const dialogB = await abrirEdicionDeFase(otra, original)

    await dialogB.getByLabel('Nombre *').fill(primero)
    await dialogB.getByRole('button', { name: 'Guardar' }).click()
    await guardarAunqueParezca(otra, 'Fase actualizada.')
    await expect(dialogB).toBeHidden()

    await dialogA.getByLabel('Nombre *').fill(segundo)
    await dialogA.getByRole('button', { name: 'Guardar' }).click()
    const aviso = page.getByRole('alertdialog').filter({ hasText: 'Nombres similares encontrados' })
    const error = page.getByText(conflicto)
    await expect(aviso.or(error)).toBeVisible()
    if (await aviso.isVisible()) {
      await aviso.getByRole('button', { name: 'Si, es diferente — Continuar' }).click()
    }
    await expect(error).toBeVisible()
    await expect(dialogA.getByRole('heading', { name: 'Editar Fase' })).toBeVisible()
    await expect(page.getByText('Fase actualizada.')).toHaveCount(0)

    await dialogA.getByRole('button', { name: 'Close' }).click()
    await expect(dialogA).toBeHidden()
    await page.getByPlaceholder('Buscar fases...').fill(primero)
    await expect(page.locator('tbody td.font-medium').filter({ hasText: primero })).toBeVisible()
    await page.getByPlaceholder('Buscar fases...').fill(segundo)
    await expect(page.getByText('No se encontraron fases con ese criterio.')).toBeVisible()

    await eliminarFase(page, primero)
    creada = false
  } finally {
    await otra.close()
    if (creada) {
      const busqueda = page.getByPlaceholder('Buscar fases...')
      await busqueda.fill(String(marca))
      const fila = page.locator('tbody tr').filter({ hasText: String(marca) })
      if ((await fila.count()) > 0) {
        const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
        const abierto = page.getByRole('dialog')
        if (await abierto.isVisible().catch(() => false)) {
          await abierto.getByRole('button', { name: 'Close' }).click({ force: true }).catch(() => undefined)
        }
        await eliminarFase(page, nombre).catch((error: unknown) => {
          const detalle = error instanceof Error ? error.message : String(error)
          throw new Error(`Quedó la fase ${nombre}. Bórrala a mano. ${detalle}`)
        })
      }
    }
  }
})
