import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { assertSinOverlayDeNext } from '../soporte'

async function confirmarSiElNombreParece(page: Page) {
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Nombres similares encontrados' })
  const creada = page.getByText('Empresa creada.')
  await expect(aviso.or(creada)).toBeVisible()
  if (await aviso.isVisible()) {
    await aviso.getByRole('button', { name: 'Si, es diferente — Continuar' }).click()
    await expect(aviso).toBeHidden()
  }
  await expect(creada).toBeVisible()
}

async function eliminarEmpresa(page: Page, nombre: string) {
  const busqueda = page.getByPlaceholder('Buscar empresas...')
  await busqueda.fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()

  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
  await dialog.getByRole('button', { name: 'Eliminar' }).click()
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Eliminar empresa' })
  await aviso.getByRole('button', { name: 'Eliminar' }).click()
  await expect(fila).toHaveCount(0)
  await expect(page.getByText('Empresa eliminada.')).toBeVisible()
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

async function abrirEdicionDeEmpresa(page: Page, nombre: string) {
  await page.getByPlaceholder('Buscar empresas...').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Empresa' })).toBeVisible()
  await expect(dialog.getByLabel('Nombre *')).toHaveValue(nombre)
  return dialog
}

async function limpiarEmpresasDePrueba(page: Page) {
  const busqueda = page.getByPlaceholder('Buscar empresas...')
  await busqueda.fill('E2E EMPRESA')
  for (let i = 0; i < 5; i += 1) {
    const fila = page.locator('tbody tr').filter({ hasText: /E2E EMPRESA \d+/ })
    if ((await fila.count()) === 0) break
    const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
    await eliminarEmpresa(page, nombre)
    await busqueda.fill('E2E EMPRESA')
  }
  await busqueda.fill('')
}

test.beforeEach(async ({ page }) => {
  const response = await page.goto('/dashboard/proyectos/empresas')
  expect(response?.status() ?? 0).toBeLessThan(400)
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { level: 1, name: 'Empresas' })).toBeVisible()
  await assertSinOverlayDeNext(page)
})

test('una búsqueda sin coincidencias vacía la lista y se puede deshacer', async ({ page }) => {
  const contador = page.getByText(/^\d+ empresas?$/)
  await expect(contador).toBeVisible()
  const antes = (await contador.innerText()).trim()

  const busqueda = page.getByPlaceholder('Buscar empresas...')
  await busqueda.fill('___sin_coincidencias___')
  await expect(page.getByText('0 empresas')).toBeVisible()
  await expect(page.getByText('No se encontraron empresas con ese criterio.')).toBeVisible()

  await busqueda.fill('')
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
  await expect(page.getByText('No se encontraron empresas con ese criterio.')).toHaveCount(0)
})

test('exportar CSV incluye Codigo y Nombre y no toca la base', async ({ page }) => {
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toBe(`empresas-${new Date().toISOString().slice(0, 10)}.csv`)

  const ruta = await archivo.path()
  expect(ruta).toBeTruthy()
  const csv = await readFile(ruta as string, 'utf8')
  const encabezado = csv.split('\n')[0] ?? ''
  expect(encabezado).toContain('Codigo')
  expect(encabezado).toContain('Nombre')
  expect(encabezado).not.toContain('cuenta')
})

test('nueva empresa exige nombre y se cierra sin guardar', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nueva Empresa' })
  await expect(nuevo).toBeEnabled()
  await nuevo.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Nueva Empresa', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Nombre *')).toHaveValue('')

  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('El nombre es requerido.')).toBeVisible()
  await expect(dialog.getByText('Nueva Empresa', { exact: true })).toBeVisible()

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Empresas' })).toBeVisible()
})

test('ver una empresa y cancelar la edición no guarda cambios', async ({ page }) => {
  const vacio = page.getByText('Todavia no hay empresas. Haz clic en "Nueva Empresa" para comenzar.')
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene empresas.')

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
  await expect(dialog.getByRole('heading', { name: 'Editar Empresa' })).toBeVisible()
  const campo = dialog.getByLabel('Nombre *')
  await expect(campo).toHaveValue(nombre)
  await campo.fill(`${nombre} CAMBIO QUE NO SE GUARDA`)

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(titulo).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Editar Empresa' })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})

test('nueva empresa exige razon social', async ({ page }) => {
  await page.getByRole('button', { name: 'Nueva Empresa' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nueva Empresa' })
  await dialog.getByLabel('Nombre *').fill('EMPRESA DE PRUEBA')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('La razon social es requerida.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const razon = dialog.getByLabel('Razon Social *')
  await expect(razon).toBeVisible()
  await expect(razon).toHaveAttribute('aria-invalid', 'true')
  await expect(razon).toBeFocused()
  await expect(dialog.getByLabel('Nombre *')).not.toHaveAttribute('aria-invalid', 'true')
  await expect(dialog.getByText('Nueva Empresa', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('un nombre parecido avisa y cancelar no guarda', async ({ page }) => {
  const vacio = page.getByText('Todavia no hay empresas. Haz clic en "Nueva Empresa" para comenzar.')
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene empresas.')

  const contador = page.getByText(/^\d+ empresas?$/)
  const antes = (await contador.innerText()).trim()
  const nombre = (await page.locator('tbody tr').first().locator('td.font-medium').innerText()).trim()
  expect(nombre.length).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Nueva Empresa' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nueva Empresa' })
  await dialog.getByLabel('Nombre *').fill(nombre)
  await dialog.getByLabel('Razon Social *').fill('RAZON SOCIAL DE PRUEBA')
  await dialog.getByLabel('ID Tributaria *').fill('CF')
  await dialog.getByLabel('Direccion *').fill('DIRECCION DE PRUEBA')
  await dialog.getByRole('button', { name: 'Seleccionar país' }).click()
  await dialog.getByText('GUATEMALA', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  const aviso = page.getByRole('alertdialog')
  await expect(aviso.getByRole('heading', { name: 'Nombres similares encontrados' })).toBeVisible()
  await aviso.getByRole('button', { name: 'Cancelar' }).click()
  await expect(aviso).toBeHidden()
  await expect(page.getByText('Empresa creada.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
})

test('crea una empresa con nombre único y la elimina', async ({ page }) => {
  await limpiarEmpresasDePrueba(page)

  const nombre = `E2E EMPRESA ${Date.now()}`
  let creada = false
  try {
    await page.getByRole('button', { name: 'Nueva Empresa' }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: 'Nueva Empresa' })
    await dialog.getByLabel('Nombre *').fill(nombre)
    await dialog.getByLabel('Razon Social *').fill(`RAZON ${nombre}`)
    await dialog.getByLabel('ID Tributaria *').fill('CF')
    await dialog.getByLabel('Direccion *').fill('DIRECCION E2E')
    await dialog.getByRole('button', { name: 'Seleccionar país' }).click()
    await dialog.getByText('GUATEMALA', { exact: true }).click()
    await expect(dialog.locator('#departamento')).not.toHaveValue('')
    await expect(dialog.locator('#municipio')).not.toHaveValue('')
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await confirmarSiElNombreParece(page)
    creada = true
    await expect(dialog).toBeHidden()

    await page.getByPlaceholder('Buscar empresas...').fill(nombre)
    await expect(page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })).toHaveCount(1)
    await expect(page.getByText('1 empresa')).toBeVisible()

    await eliminarEmpresa(page, nombre)
    creada = false
    await expect(page.getByText('No se encontraron empresas con ese criterio.')).toBeVisible()
    await expect(page.getByText('0 empresas')).toBeVisible()
  } finally {
    if (creada) {
      await eliminarEmpresa(page, nombre).catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : String(error)
        throw new Error(`Quedó la empresa ${nombre}. Bórrala a mano. ${detalle}`)
      })
    }
  }
})

test('editar una empresa con la dirección vacía marca ese campo y no guarda', async ({ page }) => {
  const vacio = page.getByText('Todavia no hay empresas. Haz clic en "Nueva Empresa" para comenzar.')
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene empresas.')

  const fila = page.locator('tbody tr').first()
  const nombre = (await fila.locator('td.font-medium').innerText()).trim()
  expect(nombre.length).toBeGreaterThan(0)
  await fila.dblclick()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Empresa' })).toBeVisible()
  await dialog.getByLabel('Direccion *').fill('')
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('La direccion es requerida.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const campo = dialog.getByLabel('Direccion *')
  await expect(campo).toBeVisible()
  await expect(campo).toHaveAttribute('aria-invalid', 'true')
  await expect(campo).toBeFocused()
  await expect(dialog.getByLabel('Nombre *')).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Empresa actualizada.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})

test('dos pestañas editan la misma empresa y solo la primera grabación vale', async ({ page }) => {
  const marca = Date.now()
  const original = `E2E EMPRESA ${marca}`
  const primero = `KILO NORTE ${marca}`
  const segundo = `VASO SUR ${marca}`
  const conflicto = 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'
  let creada = false
  const otra = await page.context().newPage()

  try {
    await page.getByRole('button', { name: 'Nueva Empresa' }).click()
    const alta = page.getByRole('dialog').filter({ hasText: 'Nueva Empresa' })
    await alta.getByLabel('Nombre *').fill(original)
    await alta.getByLabel('Razon Social *').fill(`RAZON ${original}`)
    await alta.getByLabel('ID Tributaria *').fill('CF')
    await alta.getByLabel('Direccion *').fill('DIRECCION E2E')
    await alta.getByRole('button', { name: 'Seleccionar país' }).click()
    await alta.getByText('GUATEMALA', { exact: true }).click()
    await expect(alta.locator('#departamento')).not.toHaveValue('')
    await expect(alta.locator('#municipio')).not.toHaveValue('')
    await alta.getByRole('button', { name: 'Guardar' }).click()
    await confirmarSiElNombreParece(page)
    await expect(alta).toBeHidden()
    creada = true

    const dialogA = await abrirEdicionDeEmpresa(page, original)

    await otra.goto('/dashboard/proyectos/empresas')
    await expect(otra).not.toHaveURL(/\/login/)
    await expect(otra.getByRole('heading', { level: 1, name: 'Empresas' })).toBeVisible()
    const dialogB = await abrirEdicionDeEmpresa(otra, original)

    await dialogB.getByLabel('Nombre *').fill(primero)
    await dialogB.getByRole('button', { name: 'Guardar' }).click()
    await guardarAunqueParezca(otra, 'Empresa actualizada.')
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
    await expect(dialogA.getByRole('heading', { name: 'Editar Empresa' })).toBeVisible()
    await expect(page.getByText('Empresa actualizada.')).toHaveCount(0)

    await dialogA.getByRole('button', { name: 'Close' }).click()
    await expect(dialogA).toBeHidden()
    await page.getByPlaceholder('Buscar empresas...').fill(primero)
    await expect(page.locator('tbody td.font-medium').filter({ hasText: primero })).toBeVisible()
    await page.getByPlaceholder('Buscar empresas...').fill(segundo)
    await expect(page.getByText('No se encontraron empresas con ese criterio.')).toBeVisible()

    await eliminarEmpresa(page, primero)
    creada = false
  } finally {
    await otra.close()
    if (creada) {
      const busqueda = page.getByPlaceholder('Buscar empresas...')
      await busqueda.fill(String(marca))
      const fila = page.locator('tbody tr').filter({ hasText: String(marca) })
      if ((await fila.count()) > 0) {
        const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
        const abierto = page.getByRole('dialog')
        if (await abierto.isVisible().catch(() => false)) {
          await abierto.getByRole('button', { name: 'Close' }).click().catch(() => undefined)
        }
        await eliminarEmpresa(page, nombre).catch((error: unknown) => {
          const detalle = error instanceof Error ? error.message : String(error)
          throw new Error(`Quedó la empresa ${nombre}. Bórrala a mano. ${detalle}`)
        })
      }
    }
  }
})
