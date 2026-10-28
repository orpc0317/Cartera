import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { assertSinOverlayDeNext } from '../soporte'

const CONTADOR = /^\d+ coordinador(?:es)?$/
const VACIO = 'Todavia no hay coordinadores. Haz clic en "Nuevo Coordinador" para comenzar.'
const CONFLICTO = 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'

async function valorDeVista(dialog: Locator, etiqueta: string) {
  return (await dialog.getByText(etiqueta, { exact: true }).locator('xpath=..').locator('span').last().innerText()).trim()
}

function textoDelTrigger(texto: string) {
  return texto.replace(/[▼▾]/g, '').replace(/\s+/g, ' ').trim()
}

async function empresaProyectoSupervisor(page: Page) {
  await page.locator('tbody tr').first().dblclick()
  const dialog = page.getByRole('dialog')
  const empresa = await valorDeVista(dialog, 'Empresa')
  const proyecto = await valorDeVista(dialog, 'Proyecto')
  const supervisor = await valorDeVista(dialog, 'Supervisor')
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  return { empresa, proyecto, supervisor }
}

async function asegurarSupervisor(dialog: Locator) {
  const trigger = dialog.locator('#supervisor')
  const texto = textoDelTrigger(await trigger.innerText())
  if (texto && texto !== 'Selecciona supervisor' && texto !== '0') return
  await trigger.click()
  const opcion = dialog.page().getByRole('option').first()
  await expect(opcion, 'El proyecto preseleccionado no tiene supervisores.').toBeVisible()
  await opcion.click()
}

async function elegirOpcion(dialog: Locator, indice: number, nombre: string) {
  const trigger = dialog.locator('[data-slot="select-trigger"]').nth(indice)
  const actual = textoDelTrigger(await trigger.innerText())
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

async function crearCoordinador(page: Page, nombre: string) {
  const combo = (await page.getByText(VACIO).isVisible()) ? null : await empresaProyectoSupervisor(page)
  await page.getByRole('button', { name: 'Nuevo Coordinador' }).click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nuevo Coordinador' }) })
  if (combo) {
    await elegirOpcion(dialog, 0, combo.empresa)
    await elegirOpcion(dialog, 1, combo.proyecto)
    await elegirOpcion(dialog, 2, combo.supervisor)
  } else {
    await asegurarSupervisor(dialog)
  }
  await dialog.getByLabel('Nombre *').fill(nombre)
  await expect(dialog.getByLabel('Nombre *')).toHaveValue(nombre)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await confirmarSiParece(page, 'Coordinador creado.')
  await expect(dialog).toBeHidden()
}

async function abrirEdicion(page: Page, nombre: string) {
  await page.getByPlaceholder('Buscar coordinador…').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Coordinador' })).toBeVisible()
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

async function eliminarCoordinador(page: Page, nombre: string) {
  await cerrarLoAbierto(page)
  await page.getByPlaceholder('Buscar coordinador…').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
  await dialog.getByRole('button', { name: 'Eliminar' }).click()
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Eliminar coordinador' })
  await aviso.getByRole('button', { name: 'Eliminar' }).click()
  await expect(aviso).toBeHidden()
  const ok = page.getByText('Coordinador eliminado.')
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
  const busqueda = page.getByPlaceholder('Buscar coordinador…')
  const criterios: Array<[string, RegExp]> = [
    ['E2E COORDINADOR', /E2E COORDINADOR \d+/],
    ['KILO NORTE', /KILO NORTE \d+/],
    ['VASO SUR', /VASO SUR \d+/],
  ]
  for (const [prefijo, criterio] of criterios) {
    await busqueda.fill(prefijo)
    for (let i = 0; i < 5; i += 1) {
      const fila = page.locator('tbody tr').filter({ hasText: criterio })
      if ((await fila.count()) === 0) break
      const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
      await eliminarCoordinador(page, nombre)
      await busqueda.fill(prefijo)
    }
  }
  await busqueda.fill('')
}

test.beforeEach(async ({ page }) => {
  const response = await page.goto('/dashboard/promesas/coordinadores')
  expect(response?.status() ?? 0).toBeLessThan(400)
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { level: 1, name: 'Coordinadores' })).toBeVisible()
  await assertSinOverlayDeNext(page)
})

test('una búsqueda sin coincidencias vacía la lista y se puede deshacer', async ({ page }) => {
  const contador = page.getByText(CONTADOR)
  await expect(contador).toBeVisible()
  const antes = (await contador.innerText()).trim()

  const busqueda = page.getByPlaceholder('Buscar coordinador…')
  await busqueda.fill('___sin_coincidencias___')
  await expect(page.getByText('0 coordinadores')).toBeVisible()
  await expect(page.getByText('No se encontraron coordinadores con ese criterio.')).toBeVisible()

  await busqueda.fill('')
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
  await expect(page.getByText('No se encontraron coordinadores con ese criterio.')).toHaveCount(0)
})

test('exportar CSV usa las columnas visibles y no toca la base', async ({ page }) => {
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toBe(`coordinadores-${new Date().toISOString().slice(0, 10)}.csv`)

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
  expect(encabezado).not.toContain('Supervisor')
})

test('nuevo coordinador exige nombre y se cierra sin guardar', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nuevo Coordinador' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')
  await nuevo.click()

  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nuevo Coordinador' }) })
  const supervisor = dialog.locator('#supervisor')
  const texto = textoDelTrigger(await supervisor.innerText())
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  if (!texto || texto === 'Selecciona supervisor' || texto === '0') {
    await expect(page.getByText('El supervisor es requerido.')).toBeVisible()
    await expect(supervisor).toHaveAttribute('aria-invalid', 'true')
    await expect(supervisor).toBeFocused()
  } else {
    await expect(page.getByText('El nombre es requerido.')).toBeVisible()
    const nombre = dialog.getByLabel('Nombre *')
    await expect(nombre).toHaveAttribute('aria-invalid', 'true')
    await expect(nombre).toBeFocused()
  }
  await expect(page.getByText('Coordinador creado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('nuevo coordinador exige nombre cuando el supervisor ya esta elegido', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nuevo Coordinador' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')
  const combo = (await page.getByText(VACIO).isVisible()) ? null : await empresaProyectoSupervisor(page)
  await nuevo.click()

  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nuevo Coordinador' }) })
  if (combo) {
    await elegirOpcion(dialog, 0, combo.empresa)
    await elegirOpcion(dialog, 1, combo.proyecto)
    await elegirOpcion(dialog, 2, combo.supervisor)
  } else {
    await asegurarSupervisor(dialog)
  }
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('El nombre es requerido.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const nombre = dialog.getByLabel('Nombre *')
  await expect(nombre).toHaveAttribute('aria-invalid', 'true')
  await expect(nombre).toBeFocused()
  await expect(dialog.locator('#supervisor')).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Coordinador creado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('ver un coordinador y cancelar la edición no guarda cambios', async ({ page }) => {
  test.skip(await page.getByText(VACIO).isVisible(), 'La cuenta de prueba no tiene coordinadores.')

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
  await expect(dialog.getByRole('heading', { name: 'Editar Coordinador' })).toBeVisible()
  await dialog.getByLabel('Nombre *').fill(`${nombre} CAMBIO QUE NO SE GUARDA`)
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(titulo).toBeVisible()
  await expect(page.getByText('Coordinador actualizado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})

test('editar con el nombre vacío marca el campo y no guarda', async ({ page }) => {
  test.skip(await page.getByText(VACIO).isVisible(), 'La cuenta de prueba no tiene coordinadores.')

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
  await expect(page.getByText('Coordinador actualizado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})

test('un nombre parecido avisa y cancelar no guarda', async ({ page }) => {
  test.skip(await page.getByText(VACIO).isVisible(), 'La cuenta de prueba no tiene coordinadores.')

  const contador = page.getByText(CONTADOR)
  const antes = (await contador.innerText()).trim()
  const nombre = (await page.locator('tbody tr').first().locator('td.font-medium').innerText()).trim()
  const combo = await empresaProyectoSupervisor(page)

  await page.getByRole('button', { name: 'Nuevo Coordinador' }).click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nuevo Coordinador' }) })
  await elegirOpcion(dialog, 0, combo.empresa)
  await elegirOpcion(dialog, 1, combo.proyecto)
  await elegirOpcion(dialog, 2, combo.supervisor)
  await dialog.getByLabel('Nombre *').fill(nombre)
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  const aviso = page.getByRole('alertdialog')
  await expect(aviso.getByRole('heading', { name: 'Nombres similares encontrados' })).toBeVisible()
  await aviso.getByRole('button', { name: 'Cancelar' }).click()
  await expect(aviso).toBeHidden()
  await expect(page.getByText('Coordinador creado.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
})

test('crea un coordinador con nombre único y lo elimina', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nuevo Coordinador' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')
  await limpiar(page)

  const nombre = `E2E COORDINADOR ${Date.now()}`
  let creado = false
  try {
    await crearCoordinador(page, nombre)
    creado = true
    await page.getByPlaceholder('Buscar coordinador…').fill(nombre)
    await expect(page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })).toHaveCount(1)
    await expect(page.getByText('1 coordinador')).toBeVisible()
    await eliminarCoordinador(page, nombre)
    creado = false
    await expect(page.getByText('No se encontraron coordinadores con ese criterio.')).toBeVisible()
    await expect(page.getByText('0 coordinadores')).toBeVisible()
  } finally {
    if (creado) {
      await eliminarCoordinador(page, nombre).catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : String(error)
        throw new Error(`Quedó el coordinador ${nombre}. Bórralo a mano. ${detalle}`)
      })
    }
  }
})

test('dos pestañas editan el mismo coordinador y solo la primera grabación vale', async ({ page }) => {
  test.setTimeout(90_000)
  const nuevo = page.getByRole('button', { name: 'Nuevo Coordinador' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene proyectos.')
  await limpiar(page)

  const marca = Date.now()
  const original = `E2E COORDINADOR ${marca}`
  const primero = `KILO NORTE ${marca}`
  const segundo = `VASO SUR ${marca}`
  let creado = false
  const otra = await page.context().newPage()

  try {
    await crearCoordinador(page, original)
    creado = true
    const dialogA = await abrirEdicion(page, original)

    await otra.goto('/dashboard/promesas/coordinadores')
    await expect(otra).not.toHaveURL(/\/login/)
    await expect(otra.getByRole('heading', { level: 1, name: 'Coordinadores' })).toBeVisible()
    const dialogB = await abrirEdicion(otra, original)

    await dialogB.getByLabel('Nombre *').fill(primero)
    await dialogB.getByRole('button', { name: 'Guardar' }).click()
    await confirmarSiParece(otra, 'Coordinador actualizado.')
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
    await expect(dialogA.getByRole('heading', { name: 'Editar Coordinador' })).toBeVisible()
    await expect(page.getByText('Coordinador actualizado.')).toHaveCount(0)

    await dialogA.getByRole('button', { name: 'Close' }).click()
    await expect(dialogA).toBeHidden()
    await page.getByPlaceholder('Buscar coordinador…').fill(primero)
    await expect(page.locator('tbody td.font-medium').filter({ hasText: primero })).toBeVisible()
    await page.getByPlaceholder('Buscar coordinador…').fill(segundo)
    await expect(page.getByText('No se encontraron coordinadores con ese criterio.')).toBeVisible()

    await eliminarCoordinador(page, primero)
    creado = false
  } finally {
    await otra.close()
    if (creado) {
      await page.getByPlaceholder('Buscar coordinador…').fill(String(marca))
      const fila = page.locator('tbody tr').filter({ hasText: String(marca) })
      if ((await fila.count()) > 0) {
        const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
        await eliminarCoordinador(page, nombre).catch((error: unknown) => {
          const detalle = error instanceof Error ? error.message : String(error)
          throw new Error(`Quedó el coordinador ${nombre}. Bórralo a mano. ${detalle}`)
        })
      }
    }
  }
})
