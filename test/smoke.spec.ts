import { expect, test } from '@playwright/test'
import { assertSinOverlayDeNext } from './soporte'

const SALUDO = /Buenos días|Buenas tardes|Buenas noches|Hola/

const PANTALLAS: { ruta: string; titulo: string | RegExp }[] = [
  { ruta: '/dashboard', titulo: SALUDO },
  { ruta: '/dashboard/home', titulo: SALUDO },
  { ruta: '/dashboard/kpis', titulo: 'Dashboard' },
  { ruta: '/dashboard/proyectos/empresas', titulo: 'Empresas' },
  { ruta: '/dashboard/proyectos/proyectos', titulo: 'Proyectos' },
  { ruta: '/dashboard/proyectos/fases', titulo: 'Fases' },
  { ruta: '/dashboard/proyectos/manzanas', titulo: 'Manzanas' },
  { ruta: '/dashboard/proyectos/lotes', titulo: 'Lotes' },
  { ruta: '/dashboard/bancos/bancos', titulo: 'Bancos' },
  { ruta: '/dashboard/bancos/cuentas-bancarias', titulo: 'Cuentas Bancarias' },
  { ruta: '/dashboard/bancos/tasas-cambio', titulo: 'Tasas de Cambio' },
  { ruta: '/dashboard/bancos/operaciones/depositar-pagos', titulo: 'Depositar Pagos' },
  { ruta: '/dashboard/bancos/operaciones/transacciones', titulo: 'Transacciones Bancarias' },
  { ruta: '/dashboard/promesas/clientes', titulo: 'Clientes' },
  { ruta: '/dashboard/promesas/supervisores', titulo: 'Supervisores' },
  { ruta: '/dashboard/promesas/coordinadores', titulo: 'Coordinadores' },
  { ruta: '/dashboard/promesas/vendedores', titulo: 'Vendedores' },
  { ruta: '/dashboard/promesas/cobradores', titulo: 'Cobradores' },
  { ruta: '/dashboard/promesas/reservas', titulo: 'Reservas' },
  { ruta: '/dashboard/promesas/promesas', titulo: 'Promesas' },
  { ruta: '/dashboard/cuentas-cobrar/series-recibos', titulo: 'Series de Recibos' },
  { ruta: '/dashboard/cuentas-cobrar/tipos-ingresos', titulo: 'Tipos Ingresos' },
  { ruta: '/dashboard/cuentas-cobrar/operaciones/pago-cuotas', titulo: 'Pago Cuotas' },
  { ruta: '/dashboard/cuentas-cobrar/operaciones/pagos', titulo: 'Mantenimiento Pagos' },
  { ruta: '/dashboard/generales/tipos-documento', titulo: 'Tipos Documento' },
  { ruta: '/dashboard/generales/gface', titulo: 'GFACE' },
]

for (const pantalla of PANTALLAS) {
  test(pantalla.ruta, async ({ page }) => {
    const fallos: string[] = []
    page.on('pageerror', (error) => fallos.push(error.message))

    const response = await page.goto(pantalla.ruta)
    expect(response?.status() ?? 0, pantalla.ruta).toBeLessThan(400)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { level: 1, name: pantalla.titulo })).toBeVisible()
    await assertSinOverlayDeNext(page)
    expect(fallos, fallos.join('\n')).toEqual([])
  })
}
