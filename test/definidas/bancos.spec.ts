import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { assertSinOverlayDeNext } from '../soporte'

async function confirmarSiElNombreParece(page: Page) {
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Nombres similares encontrados' })
  const creado = page.getByText('Banco creado.')
  await expect(aviso.or(creado)).toBeVisible()
  if (await aviso.isVisible()) {
    await aviso.getByRole('button', { name: 'Si, es diferente — Continuar' }).click()
    await expect(aviso).toBeHidden()
  }
  await expect(creado).toBeVisible()
}

async function eliminarBanco(page: Page, nombre: string) {
  const busqueda = page.getByPlaceholder('Buscar bancos...')
  await busqueda.fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()

  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
  await dialog.getByRole('button', { name: 'Eliminar' }).click()
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Eliminar banco' })
  await aviso.getByRole('button', { name: 'Eliminar' }).click()
  await expect(fila).toHaveCount(0)
  await expect(page.getByText('Banco eliminado.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click({ timeout: 3_000 }).catch(() => undefined)
}

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

async function abrirEdicionDeBanco(page: Page, nombre: string) {
  await page.getByPlaceholder('Buscar bancos...').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Banco' })).toBeVisible()
  await expect(dialog.getByLabel('Nombre *')).toHaveValue(nombre)
  return dialog
}

async function limpiarBancosDePrueba(page: Page) {
  const busqueda = page.getByPlaceholder('Buscar bancos...')
  await busqueda.fill('E2E BANCO')
  for (let i = 0; i < 5; i += 1) {
    const fila = page.locator('tbody tr').filter({ hasText: /E2E BANCO \d+/ })
    if ((await fila.count()) === 0) break
    const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
    await eliminarBanco(page, nombre)
    await busqueda.fill('E2E BANCO')
  }
  await busqueda.fill('')
}

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
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const nombre = dialog.getByLabel('Nombre *')
  await expect(nombre).toBeVisible()
  await expect(nombre).toHaveAttribute('aria-invalid', 'true')
  await expect(nombre).toBeFocused()
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

test('un nombre parecido avisa y cancelar no guarda', async ({ page }) => {
  const vacio = page.getByText('No hay bancos registrados aun.')
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene bancos.')

  const contador = page.getByText(/^\d+ bancos?$/)
  const antes = (await contador.innerText()).trim()
  const fila = page.locator('tbody tr').first()
  const proyecto = (await fila.locator('td').nth(1).innerText()).replace(/\s+/g, ' ').trim()
  const nombre = (await fila.locator('td.font-medium').innerText()).trim()
  expect(nombre.length).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Nuevo Banco' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nuevo Banco' })
  await dialog.locator('[data-slot="select-trigger"]').nth(1).click()
  await page.getByRole('option', { name: proyecto, exact: true }).click()
  await dialog.getByLabel('Nombre *').fill(nombre)
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  const aviso = page.getByRole('alertdialog')
  await expect(aviso.getByRole('heading', { name: 'Nombres similares encontrados' })).toBeVisible()
  await aviso.getByRole('button', { name: 'Cancelar' }).click()
  await expect(aviso).toBeHidden()
  await expect(page.getByText('Banco creado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
})

test('crea un banco con nombre único y lo elimina', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nuevo Banco' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')

  await limpiarBancosDePrueba(page)

  const nombre = `E2E BANCO ${Date.now()}`
  let creado = false
  try {
    await nuevo.click()
    const dialog = page.getByRole('dialog').filter({ hasText: 'Nuevo Banco' })
    await dialog.getByLabel('Nombre *').fill(nombre)
    await expect(dialog.getByLabel('Nombre *')).toHaveValue(nombre)
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await confirmarSiElNombreParece(page)
    creado = true
    await expect(dialog).toBeHidden()

    await page.getByPlaceholder('Buscar bancos...').fill(nombre)
    await expect(page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })).toHaveCount(1)
    await expect(page.getByText('1 banco')).toBeVisible()

    await eliminarBanco(page, nombre)
    creado = false
    await expect(page.getByText('Sin resultados para esa busqueda.')).toBeVisible()
    await expect(page.getByText('0 bancos')).toBeVisible()
  } finally {
    if (creado) {
      await eliminarBanco(page, nombre).catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : String(error)
        throw new Error(`Quedó el banco ${nombre}. Bórralo a mano. ${detalle}`)
      })
    }
  }
})

test('editar un banco con el nombre vacío marca el campo y no guarda', async ({ page }) => {
  const vacio = page.getByText('No hay bancos registrados aun.')
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene bancos.')

  const fila = page.locator('tbody tr').first()
  const nombre = (await fila.locator('td.font-medium').innerText()).trim()
  expect(nombre.length).toBeGreaterThan(0)
  await fila.dblclick()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Banco' })).toBeVisible()
  await dialog.getByLabel('Nombre *').fill('')
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('El nombre es requerido.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const campo = dialog.getByLabel('Nombre *')
  await expect(campo).toBeVisible()
  await expect(campo).toHaveAttribute('aria-invalid', 'true')
  await expect(campo).toBeFocused()
  await expect(page.getByText('Banco actualizado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})

test('dos pestañas editan el mismo banco y solo la primera grabación vale', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nuevo Banco' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')

  const marca = Date.now()
  const original = `E2E BANCO ${marca}`
  const primero = `KILO NORTE ${marca}`
  const segundo = `VASO SUR ${marca}`
  const conflicto = 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'
  let creado = false
  const otra = await page.context().newPage()

  try {
    await nuevo.click()
    const alta = page.getByRole('dialog').filter({ hasText: 'Nuevo Banco' })
    await alta.getByLabel('Nombre *').fill(original)
    await alta.getByRole('button', { name: 'Guardar' }).click()
    await confirmarSiElNombreParece(page)
    await expect(alta).toBeHidden()
    creado = true

    const dialogA = await abrirEdicionDeBanco(page, original)

    await otra.goto('/dashboard/bancos/bancos')
    await expect(otra).not.toHaveURL(/\/login/)
    await expect(otra.getByRole('heading', { level: 1, name: 'Bancos' })).toBeVisible()
    const dialogB = await abrirEdicionDeBanco(otra, original)

    await dialogB.getByLabel('Nombre *').fill(primero)
    await dialogB.getByRole('button', { name: 'Guardar' }).click()
    await guardarAunqueParezca(otra, 'Banco actualizado.')
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
    await expect(dialogA.getByRole('heading', { name: 'Editar Banco' })).toBeVisible()
    await expect(page.getByText('Banco actualizado.')).toHaveCount(0)

    await dialogA.getByRole('button', { name: 'Close' }).click()
    await expect(dialogA).toBeHidden()
    await page.getByPlaceholder('Buscar bancos...').fill(primero)
    await expect(page.locator('tbody td.font-medium').filter({ hasText: primero })).toBeVisible()
    await page.getByPlaceholder('Buscar bancos...').fill(segundo)
    await expect(page.getByText('Sin resultados para esa busqueda.')).toBeVisible()

    await eliminarBanco(page, primero)
    creado = false
  } finally {
    await otra.close()
    if (creado) {
      const busqueda = page.getByPlaceholder('Buscar bancos...')
      await busqueda.fill(String(marca))
      const fila = page.locator('tbody tr').filter({ hasText: String(marca) })
      if ((await fila.count()) > 0) {
        const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
        const abierto = page.getByRole('dialog')
        if (await abierto.isVisible().catch(() => false)) {
          await abierto.getByRole('button', { name: 'Close' }).click().catch(() => undefined)
        }
        await eliminarBanco(page, nombre).catch((error: unknown) => {
          const detalle = error instanceof Error ? error.message : String(error)
          throw new Error(`Quedó el banco ${nombre}. Bórralo a mano. ${detalle}`)
        })
      }
    }
  }
})
