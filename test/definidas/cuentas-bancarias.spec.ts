import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { assertSinOverlayDeNext } from '../soporte'

const CONTADOR = /^\d+ cuentas? bancarias?$/
const VACIO = 'Todavia no hay cuentas bancarias. Haz clic en "Nueva Cuenta" para comenzar.'

async function valorDeVista(dialog: Locator, etiqueta: string) {
  return (await dialog.getByText(etiqueta, { exact: true }).locator('xpath=..').locator('span').last().innerText()).trim()
}

async function combinacionDeLaPrimeraFila(page: Page) {
  const fila = page.locator('tbody tr').first()
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  const empresa = await valorDeVista(dialog, 'Empresa')
  const proyecto = await valorDeVista(dialog, 'Proyecto')
  const banco = await valorDeVista(dialog, 'Banco')
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  return { empresa, proyecto, banco }
}

async function elegirOpcion(dialog: Locator, indice: number, nombre: string) {
  const trigger = dialog.locator('[data-slot="select-trigger"]').nth(indice)
  const actual = (await trigger.innerText()).replace(/\s+/g, ' ').trim()
  if (actual === nombre) return
  await trigger.click()
  await dialog.page().getByRole('option', { name: nombre, exact: true }).click()
}

async function crearCuentaDePrueba(page: Page, nombre: string, numero: string) {
  const vacio = page.getByText(VACIO)
  const combo = (await vacio.isVisible()) ? null : await combinacionDeLaPrimeraFila(page)
  await page.getByRole('button', { name: 'Nueva Cuenta' }).click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nueva Cuenta Bancaria' }) })
  if (combo) {
    await elegirOpcion(dialog, 0, combo.empresa)
    await elegirOpcion(dialog, 1, combo.proyecto)
    await elegirOpcion(dialog, 2, combo.banco)
  }
  await dialog.getByLabel('Numero Cuenta *').fill(numero)
  await dialog.getByLabel('Nombre Cuenta *').fill(nombre)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  const ok = page.getByText('Cuenta bancaria creada.')
  const fallo = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(ok.or(fallo)).toBeVisible()
  if (!(await ok.isVisible())) {
    throw new Error((await fallo.first().innerText()).replace(/\s+/g, ' ').trim())
  }
  await expect(dialog).toBeHidden()
}

async function abrirEdicion(page: Page, nombre: string) {
  await page.getByPlaceholder('Buscar cuentas bancarias...').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Cuenta Bancaria' })).toBeVisible()
  await expect(dialog.getByLabel('Nombre Cuenta *')).toHaveValue(nombre)
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

async function eliminarCuenta(page: Page, nombre: string) {
  await cerrarLoAbierto(page)
  await page.getByPlaceholder('Buscar cuentas bancarias...').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
  await dialog.getByRole('button', { name: 'Eliminar' }).click()
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Eliminar cuenta bancaria' })
  await aviso.getByRole('button', { name: 'Eliminar' }).click()
  await expect(aviso).toBeHidden()
  const ok = page.getByText('Cuenta bancaria eliminada.')
  const fallo = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(ok.or(fallo)).toBeVisible()
  if (!(await ok.isVisible())) {
    throw new Error((await fallo.first().innerText()).replace(/\s+/g, ' ').trim())
  }
  await expect(fila).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click({ force: true })
  await expect(dialog).toBeHidden()
}

async function limpiarCuentasDePrueba(page: Page) {
  const busqueda = page.getByPlaceholder('Buscar cuentas bancarias...')
  const criterios: Array<[string, RegExp]> = [
    ['E2E CUENTA', /E2E CUENTA \d+/],
    ['KILO NORTE', /KILO NORTE \d+/],
    ['VASO SUR', /VASO SUR \d+/],
  ]
  for (const [prefijo, criterio] of criterios) {
    await busqueda.fill(prefijo)
    for (let i = 0; i < 5; i += 1) {
      const fila = page.locator('tbody tr').filter({ hasText: criterio })
      if ((await fila.count()) === 0) break
      const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
      await eliminarCuenta(page, nombre)
      await busqueda.fill(prefijo)
    }
  }
  await busqueda.fill('')
}

test.beforeEach(async ({ page }) => {
  const response = await page.goto('/dashboard/bancos/cuentas-bancarias')
  expect(response?.status() ?? 0).toBeLessThan(400)
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { level: 1, name: 'Cuentas Bancarias' })).toBeVisible()
  await assertSinOverlayDeNext(page)
})

test('una búsqueda sin coincidencias vacía la lista y se puede deshacer', async ({ page }) => {
  const contador = page.getByText(CONTADOR)
  await expect(contador).toBeVisible()
  const antes = (await contador.innerText()).trim()

  const busqueda = page.getByPlaceholder('Buscar cuentas bancarias...')
  await busqueda.fill('___sin_coincidencias___')
  await expect(page.getByText('0 cuentas bancarias')).toBeVisible()
  await expect(page.getByText('No se encontraron cuentas bancarias con ese criterio.')).toBeVisible()

  await busqueda.fill('')
  await expect(page.getByText(antes, { exact: true })).toBeVisible()
  await expect(page.getByText('No se encontraron cuentas bancarias con ese criterio.')).toHaveCount(0)
})

test('exportar CSV usa las columnas visibles y no toca la base', async ({ page }) => {
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toBe(`cuentas-bancarias-${new Date().toISOString().slice(0, 10)}.csv`)

  const ruta = await archivo.path()
  expect(ruta).toBeTruthy()
  const csv = await readFile(ruta as string, 'utf8')
  const encabezado = csv.split('\n')[0] ?? ''
  expect(encabezado).toContain('Codigo')
  expect(encabezado).toContain('Banco')
  expect(encabezado).toContain('Nombre')
  expect(encabezado).toContain('Numero')
  expect(encabezado).toContain('Moneda')
  expect(encabezado).toContain('Activo')
  expect(encabezado).not.toContain('cuenta')
  expect(encabezado).not.toContain('Empresa')
  expect(encabezado).not.toContain('Proyecto')
})

test('nueva cuenta exige banco y se cierra sin guardar', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nueva Cuenta' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene bancos.')
  await nuevo.click()

  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nueva Cuenta Bancaria' }) })
  const banco = dialog.locator('#banco')
  await expect(banco).toHaveText(/^\s*(Selecciona banco)?\s*$/)
  await expect(dialog.getByLabel('Numero Cuenta *')).toHaveValue('')
  await expect(dialog.getByLabel('Nombre Cuenta *')).toHaveValue('')

  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Selecciona el banco.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  await expect(banco).toHaveAttribute('aria-invalid', 'true')
  await expect(banco).toBeFocused()
  await expect(page.getByText('Cuenta bancaria creada.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Cuentas Bancarias' })).toBeVisible()
})

test('nueva cuenta exige numero cuando el banco ya esta elegido', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nueva Cuenta' })
  await expect(nuevo).toBeVisible()
  test.skip(await page.getByText(VACIO).isVisible(), 'La cuenta de prueba no tiene cuentas bancarias.')
  const combo = await combinacionDeLaPrimeraFila(page)
  await nuevo.click()

  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nueva Cuenta Bancaria' }) })
  await elegirOpcion(dialog, 0, combo.empresa)
  await elegirOpcion(dialog, 1, combo.proyecto)
  await elegirOpcion(dialog, 2, combo.banco)
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('El numero de cuenta es requerido.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const numero = dialog.getByLabel('Numero Cuenta *')
  await expect(numero).toHaveAttribute('aria-invalid', 'true')
  await expect(numero).toBeFocused()
  await expect(dialog.locator('#banco')).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Cuenta bancaria creada.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('nueva cuenta exige nombre cuando el numero ya esta lleno', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nueva Cuenta' })
  await expect(nuevo).toBeVisible()
  test.skip(await page.getByText(VACIO).isVisible(), 'La cuenta de prueba no tiene cuentas bancarias.')
  const combo = await combinacionDeLaPrimeraFila(page)
  await nuevo.click()

  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Nueva Cuenta Bancaria' }) })
  await elegirOpcion(dialog, 0, combo.empresa)
  await elegirOpcion(dialog, 1, combo.proyecto)
  await elegirOpcion(dialog, 2, combo.banco)
  await dialog.getByLabel('Numero Cuenta *').fill('999000111')
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('El nombre de cuenta es requerido.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const nombre = dialog.getByLabel('Nombre Cuenta *')
  await expect(nombre).toHaveAttribute('aria-invalid', 'true')
  await expect(nombre).toBeFocused()
  await expect(dialog.getByLabel('Numero Cuenta *')).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Cuenta bancaria creada.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

test('ver una cuenta y cancelar la edición no guarda cambios', async ({ page }) => {
  const vacio = page.getByText(VACIO)
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene cuentas bancarias.')

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
  await expect(dialog.getByRole('heading', { name: 'Editar Cuenta Bancaria' })).toBeVisible()
  const campo = dialog.getByLabel('Nombre Cuenta *')
  await expect(campo).toHaveValue(nombre)
  await campo.fill(`${nombre} CAMBIO QUE NO SE GUARDA`)

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(titulo).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Editar Cuenta Bancaria' })).toHaveCount(0)
  await expect(page.getByText('Cuenta bancaria actualizada.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})

test('editar con el numero vacío marca el campo y no guarda', async ({ page }) => {
  const vacio = page.getByText(VACIO)
  test.skip(await vacio.isVisible(), 'La cuenta de prueba no tiene cuentas bancarias.')

  const fila = page.locator('tbody tr').first()
  const nombre = (await fila.locator('td.font-medium').innerText()).trim()
  expect(nombre.length).toBeGreaterThan(0)
  await fila.dblclick()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Cuenta Bancaria' })).toBeVisible()
  await dialog.getByLabel('Numero Cuenta *').fill('')
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('El numero de cuenta es requerido.')).toBeVisible()
  await expect(dialog.getByRole('tab', { name: 'General', selected: true })).toBeVisible()
  const numero = dialog.getByLabel('Numero Cuenta *')
  await expect(numero).toHaveAttribute('aria-invalid', 'true')
  await expect(numero).toBeFocused()
  await expect(page.getByText('Cuenta bancaria actualizada.')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(fila.locator('td.font-medium')).toHaveText(nombre)
})

test('crea una cuenta con nombre único y la elimina', async ({ page }) => {
  const nuevo = page.getByRole('button', { name: 'Nueva Cuenta' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene bancos.')

  await limpiarCuentasDePrueba(page)

  const marca = Date.now()
  const nombre = `E2E CUENTA ${marca}`
  const numero = `E2E${marca}`
  let creado = false
  try {
    await crearCuentaDePrueba(page, nombre, numero)
    creado = true

    await page.getByPlaceholder('Buscar cuentas bancarias...').fill(nombre)
    await expect(page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })).toHaveCount(1)
    await expect(page.getByText('1 cuenta bancaria')).toBeVisible()

    await eliminarCuenta(page, nombre)
    creado = false
    await expect(page.getByText('No se encontraron cuentas bancarias con ese criterio.')).toBeVisible()
    await expect(page.getByText('0 cuentas bancarias')).toBeVisible()
  } finally {
    if (creado) {
      await eliminarCuenta(page, nombre).catch((error: unknown) => {
        const detalle = error instanceof Error ? error.message : String(error)
        throw new Error(`Quedó la cuenta ${nombre}. Bórrala a mano. ${detalle}`)
      })
    }
  }
})

test('dos pestañas editan la misma cuenta y solo la primera grabación vale', async ({ page }) => {
  test.setTimeout(90_000)
  const nuevo = page.getByRole('button', { name: 'Nueva Cuenta' })
  await expect(nuevo).toBeVisible()
  test.skip(await nuevo.isDisabled(), 'La cuenta de prueba no tiene bancos.')

  await limpiarCuentasDePrueba(page)
  const marca = Date.now()
  const original = `E2E CUENTA ${marca}`
  const numero = `E2E${marca}`
  const primero = `KILO NORTE ${marca}`
  const segundo = `VASO SUR ${marca}`
  const conflicto = 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'
  let creado = false
  const otra = await page.context().newPage()

  try {
    await crearCuentaDePrueba(page, original, numero)
    creado = true

    const dialogA = await abrirEdicion(page, original)

    await otra.goto('/dashboard/bancos/cuentas-bancarias')
    await expect(otra).not.toHaveURL(/\/login/)
    await expect(otra.getByRole('heading', { level: 1, name: 'Cuentas Bancarias' })).toBeVisible()
    const dialogB = await abrirEdicion(otra, original)

    await dialogB.getByLabel('Nombre Cuenta *').fill(primero)
    await dialogB.getByRole('button', { name: 'Guardar' }).click()
    await expect(otra.getByText('Cuenta bancaria actualizada.')).toBeVisible()
    await expect(dialogB).toBeHidden()

    await dialogA.getByLabel('Nombre Cuenta *').fill(segundo)
    await dialogA.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText(conflicto)).toBeVisible()
    await expect(dialogA.getByRole('heading', { name: 'Editar Cuenta Bancaria' })).toBeVisible()
    await expect(page.getByText('Cuenta bancaria actualizada.')).toHaveCount(0)

    await dialogA.getByRole('button', { name: 'Close' }).click()
    await expect(dialogA).toBeHidden()

    await page.getByPlaceholder('Buscar cuentas bancarias...').fill(primero)
    await expect(page.locator('tbody td.font-medium').filter({ hasText: primero })).toBeVisible()
    await page.getByPlaceholder('Buscar cuentas bancarias...').fill(segundo)
    await expect(page.getByText('No se encontraron cuentas bancarias con ese criterio.')).toBeVisible()

    await eliminarCuenta(page, primero)
    creado = false
  } finally {
    await otra.close()
    if (creado) {
      const busqueda = page.getByPlaceholder('Buscar cuentas bancarias...')
      await busqueda.fill(String(marca))
      const fila = page.locator('tbody tr').filter({ hasText: String(marca) })
      if ((await fila.count()) > 0) {
        const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
        const abierto = page.getByRole('dialog')
        if (await abierto.isVisible().catch(() => false)) {
          await abierto.getByRole('button', { name: 'Close' }).click({ force: true }).catch(() => undefined)
        }
        await eliminarCuenta(page, nombre).catch((error: unknown) => {
          const detalle = error instanceof Error ? error.message : String(error)
          throw new Error(`Quedó la cuenta ${nombre}. Bórrala a mano. ${detalle}`)
        })
      }
    }
  }
})
