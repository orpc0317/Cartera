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

async function crearProyectoDePrueba(page: Page, nombre: string) {
  await page.getByRole('button', { name: 'Nuevo Proyecto' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nuevo Proyecto' })
  await dialog.getByLabel('Nombre Proyecto *').fill(nombre)
  await dialog.getByLabel('Direccion *').fill('CALLE LOCK')
  await dialog.locator('#telefono1').fill('5550100')
  const pais = dialog.getByRole('button', { name: 'Seleccionar país' })
  if (await pais.isVisible()) {
    await pais.click()
    await dialog.getByText('GUATEMALA', { exact: true }).click()
  }
  await expect(dialog.locator('#departamento_p')).not.toHaveValue('')
  await expect(dialog.locator('#municipio_p')).not.toHaveValue('')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await guardarAunqueParezca(page, 'Proyecto creado exitosamente.')
  await expect(dialog).toBeHidden()
}

async function abrirEdicionDeProyecto(page: Page, nombre: string) {
  await page.getByPlaceholder('Buscar proyectos...').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Editar' }).click()
  await expect(dialog.getByRole('heading', { name: 'Editar Proyecto' })).toBeVisible()
  await expect(dialog.getByLabel('Nombre Proyecto *')).toHaveValue(nombre)
  return dialog
}

async function eliminarProyecto(page: Page, nombre: string) {
  await page.getByPlaceholder('Buscar proyectos...').fill(nombre)
  const fila = page.locator('tbody tr').filter({ has: page.getByText(nombre, { exact: true }) })
  await expect(fila).toHaveCount(1)
  await fila.dblclick()
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) })
  await dialog.getByRole('button', { name: 'Eliminar' }).click()
  const aviso = page.getByRole('alertdialog').filter({ hasText: 'Eliminar proyecto' })
  await aviso.getByRole('button', { name: 'Eliminar' }).click()
  const ok = page.getByText('Proyecto eliminado.')
  const fallo = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(ok.or(fallo)).toBeVisible()
  if (!(await ok.isVisible())) {
    throw new Error((await fallo.first().innerText()).replace(/\s+/g, ' ').trim())
  }
  await expect(fila).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click({ timeout: 3_000 }).catch(() => undefined)
}

async function limpiarProyectosDePrueba(page: Page) {
  const busqueda = page.getByPlaceholder('Buscar proyectos...')
  for (const prefijo of ['E2E PROYECTO', 'KILO NORTE', 'VASO SUR']) {
    await busqueda.fill(prefijo)
    for (let i = 0; i < 5; i += 1) {
      const fila = page.locator('tbody tr').filter({ hasText: new RegExp(`${prefijo} \\d+`) })
      if ((await fila.count()) === 0) break
      const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
      const abierto = page.getByRole('dialog')
      if (await abierto.isVisible().catch(() => false)) {
        await abierto.getByRole('button', { name: 'Close' }).click().catch(() => undefined)
      }
      await eliminarProyecto(page, nombre)
    }
  }
  await busqueda.fill('')
}

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

test('dos pestañas editan el mismo proyecto y solo la primera grabación vale', async ({ page }) => {
  test.setTimeout(90_000)
  await limpiarProyectosDePrueba(page)
  const marca = Date.now()
  const original = `E2E PROYECTO ${marca}`
  const primero = `KILO NORTE ${marca}`
  const segundo = `VASO SUR ${marca}`
  const conflicto = 'Este registro fue modificado por otro usuario. Cierra el formulario, recarga los datos y vuelve a intentarlo.'
  let creado = false
  const otra = await page.context().newPage()

  try {
    await crearProyectoDePrueba(page, original)
    creado = true

    const dialogA = await abrirEdicionDeProyecto(page, original)

    await otra.goto('/dashboard/proyectos/proyectos')
    await expect(otra).not.toHaveURL(/\/login/)
    await expect(otra.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeVisible()
    const dialogB = await abrirEdicionDeProyecto(otra, original)

    await dialogB.getByLabel('Nombre Proyecto *').fill(primero)
    await dialogB.getByRole('button', { name: 'Guardar' }).click()
    await guardarAunqueParezca(otra, 'Proyecto actualizado.')
    await expect(dialogB).toBeHidden()

    await dialogA.getByLabel('Nombre Proyecto *').fill(segundo)
    await dialogA.getByRole('button', { name: 'Guardar' }).click()
    const aviso = page.getByRole('alertdialog').filter({ hasText: 'Nombres similares encontrados' })
    const error = page.getByText(conflicto)
    await expect(aviso.or(error)).toBeVisible()
    if (await aviso.isVisible()) {
      await aviso.getByRole('button', { name: 'Si, es diferente — Continuar' }).click()
    }
    await expect(error).toBeVisible()
    await expect(dialogA.getByRole('heading', { name: 'Editar Proyecto' })).toBeVisible()
    await expect(page.getByText('Proyecto actualizado.')).toHaveCount(0)

    await dialogA.getByRole('button', { name: 'Close' }).click()
    await expect(dialogA).toBeHidden()
    await page.getByPlaceholder('Buscar proyectos...').fill(primero)
    await expect(page.locator('tbody td.font-medium').filter({ hasText: primero })).toBeVisible()
    await page.getByPlaceholder('Buscar proyectos...').fill(segundo)
    await expect(page.getByText('No se encontraron proyectos con ese criterio.')).toBeVisible()

    await eliminarProyecto(page, primero)
    creado = false
  } finally {
    await otra.close()
    if (creado) {
      const busqueda = page.getByPlaceholder('Buscar proyectos...')
      await busqueda.fill(String(marca))
      const fila = page.locator('tbody tr').filter({ hasText: String(marca) })
      if ((await fila.count()) > 0) {
        const nombre = (await fila.first().locator('td.font-medium').innerText()).trim()
        const abierto = page.getByRole('dialog')
        if (await abierto.isVisible().catch(() => false)) {
          await abierto.getByRole('button', { name: 'Close' }).click().catch(() => undefined)
        }
        await eliminarProyecto(page, nombre).catch((error: unknown) => {
          const detalle = error instanceof Error ? error.message : String(error)
          throw new Error(`Quedó el proyecto ${nombre}. Bórralo a mano. ${detalle}`)
        })
      }
    }
  }
})
