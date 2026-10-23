import { jsPDF } from 'jspdf'
import autoTable, { type CellInput, type RowInput } from 'jspdf-autotable'

const ESTADO_LABEL: Record<number, string> = {
  0: 'Corriente',
  1: 'Atrasada',
  2: 'Pagada',
  3: 'Pendiente',
}

const ESTADO_COLOR: Record<string, [number, number, number]> = {
  Corriente: [29, 78, 216],
  Atrasada: [190, 18, 60],
  Pagada: [4, 120, 87],
  Pendiente: [113, 113, 122],
}

const FILL_SECTION: [number, number, number] = [253, 242, 248]
const TEXT_SECTION: [number, number, number] = [162, 28, 175]
const FILL_TOTAL: [number, number, number] = [244, 244, 245]
const FILL_GRAND: [number, number, number] = [228, 228, 231]
const TEXT_MUTED: [number, number, number] = [113, 113, 122]
const LINE: [number, number, number] = [212, 212, 216]

const MARGIN_X = 10
const MARGIN_BOTTOM = 12

export type PlanPagoPdfRow = {
  cuota: number
  fecha: string
  capital: number
  capital_pagado: number
  interes: number
  interes_pagado: number
  mora: number
  mora_pagado: number
  otrosForRow: { monto: number; monto_pagado: number }[]
  cuotaMonto: number
  cuotaPagado: number
  saldo: number
  estado: number
}

export type PlanPagoPdfInput = {
  empresaNombre: string
  proyectoNombre: string
  proyecto: number
  numero: number
  logoUrl?: string
  clienteNombre: string
  lote: string
  fechaPromesa: string
  valorLote: string
  subsidio: string
  arras: string
  enganche: string
  financiamiento: string
  interesAnual: string
  mora: string
  otrosEtiquetas: string[]
  engancheRows: PlanPagoPdfRow[]
  financiamientoRows: PlanPagoPdfRow[]
}

type Totales = {
  capital: number
  capital_pagado: number
  interes: number
  interes_pagado: number
  mora: number
  mora_pagado: number
  cuotaMonto: number
  cuotaPagado: number
  saldo: number
  otros: { monto: number; monto_pagado: number }[]
}

const fmtNum = (n: number) =>
  (n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (d: string | null | undefined) => {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function sumRows(rows: PlanPagoPdfRow[], otrosCount: number): Totales {
  const t: Totales = {
    capital: 0, capital_pagado: 0, interes: 0, interes_pagado: 0,
    mora: 0, mora_pagado: 0, cuotaMonto: 0, cuotaPagado: 0, saldo: 0,
    otros: Array.from({ length: otrosCount }, () => ({ monto: 0, monto_pagado: 0 })),
  }
  for (const r of rows) {
    t.capital += r.capital
    t.capital_pagado += r.capital_pagado
    t.interes += r.interes
    t.interes_pagado += r.interes_pagado
    t.mora += r.mora
    t.mora_pagado += r.mora_pagado
    t.cuotaMonto += r.cuotaMonto
    t.cuotaPagado += r.cuotaPagado
    t.saldo += r.saldo
    r.otrosForRow.forEach((o, i) => {
      t.otros[i].monto += o.monto
      t.otros[i].monto_pagado += o.monto_pagado
    })
  }
  return t
}

function loadLogo(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return fetch(url)
    .then((res) => {
      if (!res.ok) return null
      return res.blob()
    })
    .then((blob) => {
      if (!blob) return null
      const objectUrl = URL.createObjectURL(blob)
      return new Promise<{ dataUrl: string; width: number; height: number } | null>((resolve) => {
        const image = new Image()
        image.onload = () => {
          URL.revokeObjectURL(objectUrl)
          const nw = image.naturalWidth || 256
          const nh = image.naturalHeight || 256
          const max = 256
          const scale = Math.min(1, max / Math.max(nw, nh))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(nw * scale))
          canvas.height = Math.max(1, Math.round(nh * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) { resolve(null); return }
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
          try {
            resolve({ dataUrl: canvas.toDataURL('image/png'), width: nw, height: nh })
          } catch {
            resolve(null)
          }
        }
        image.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          resolve(null)
        }
        image.src = objectUrl
      })
    })
    .catch(() => null)
}

function logoBox(width: number, height: number) {
  const maxW = 22
  const maxH = 16
  const ratio = width / height || 1
  let w = maxW
  let h = w / ratio
  if (h > maxH) {
    h = maxH
    w = h * ratio
  }
  return { w, h }
}

// Capital e Intereses van primero. Las extras (Seguro, etc.) se insertan despues.
// Mora y Totales quedan siempre al final de los montos. El ancho cabe hasta 5 extras.
function tableLayout(otrosCount: number, contentWidth: number) {
  const many = otrosCount >= 4
  const some = otrosCount >= 2
  const cuotaW = many ? 8 : 10
  const fechaW = many ? 15 : some ? 16 : 18
  const estadoW = many ? 15 : 18
  const saldoW = many ? 14 : 16
  const moneyCols = (4 + otrosCount) * 2
  const moneyW = (contentWidth - cuotaW - fechaW - estadoW - saldoW) / moneyCols
  const widths = [
    cuotaW,
    fechaW,
    ...Array.from({ length: moneyCols }, () => moneyW),
    saldoW,
    estadoW,
  ]
  const drift = contentWidth - widths.reduce((sum, w) => sum + w, 0)
  widths[widths.length - 1] += drift
  const columnStyles: Record<string, { cellWidth: number }> = {}
  widths.forEach((cellWidth, i) => {
    columnStyles[String(i)] = { cellWidth }
  })
  const fontSize = otrosCount >= 4 ? 5.5 : otrosCount >= 2 ? 6 : otrosCount >= 1 ? 6.5 : 7
  return {
    fontSize,
    headFontSize: Math.max(5, fontSize - 0.5),
    cellPadding: otrosCount >= 4 ? 0.45 : otrosCount >= 2 ? 0.6 : 0.8,
    columnStyles,
  }
}

function pair(monto: number, pagado: number, bold = false): CellInput[] {
  const weight = bold ? 'bold' as const : 'normal' as const
  return [
    { content: fmtNum(monto), styles: { halign: 'right', fontStyle: weight } },
    { content: fmtNum(pagado), styles: { halign: 'right', fontStyle: weight, textColor: TEXT_MUTED } },
  ]
}

function paint(cells: CellInput[], fill: [number, number, number]): CellInput[] {
  return cells.map((cell) => {
    if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
      return { ...cell, styles: { ...cell.styles, fillColor: fill } }
    }
    return { content: String(cell ?? ''), styles: { fillColor: fill, fontStyle: 'bold' } }
  })
}

export async function downloadPlanPagoPdf(input: PlanPagoPdfInput) {
  const logo = input.logoUrl ? await loadLogo(input.logoUrl) : null
  const empresaNombre = input.empresaNombre || ''
  const proyectoNombre = input.proyectoNombre || ''
  const title = ['Plan de Pagos', empresaNombre, proyectoNombre].filter(Boolean).join(' · ')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setProperties({ title, subject: `Promesa ${input.numero}` })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN_X * 2

  let y = 10
  let textX = MARGIN_X
  if (logo) {
    const box = logoBox(logo.width, logo.height)
    doc.addImage(logo.dataUrl, 'PNG', MARGIN_X, y, box.w, box.h)
    textX = MARGIN_X + box.w + 4
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(24, 24, 27)
  const titleLines = doc.splitTextToSize(title, contentWidth - (textX - MARGIN_X)) as string[]
  doc.text(titleLines, textX, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_MUTED)
  doc.text(`Promesa ${input.numero}`, textX, y + 6 + titleLines.length * 5.2)
  y += Math.max(logo ? 18 : 0, 8 + titleLines.length * 5.2 + 4)

  const fields: { label: string; value: string }[] = [
    { label: 'Cliente', value: input.clienteNombre },
    { label: 'Lote', value: input.lote },
    { label: 'Fecha Promesa', value: fmtDate(input.fechaPromesa) },
    { label: 'Valor Lote', value: input.valorLote },
    { label: 'Subsidio', value: input.subsidio },
    { label: 'Arras', value: input.arras },
    { label: 'Enganche', value: input.enganche },
    { label: 'Financiamiento', value: input.financiamiento },
    { label: 'Interes Anual', value: input.interesAnual },
    { label: 'Mora', value: input.mora },
  ]
  const cols = 5
  const rows = Math.ceil(fields.length / cols)
  const boxH = rows * 9 + 3
  doc.setFillColor(250, 250, 250)
  doc.setDrawColor(...LINE)
  doc.rect(MARGIN_X, y, contentWidth, boxH, 'FD')
  const colW = contentWidth / cols
  fields.forEach((field, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = MARGIN_X + col * colW + 2
    const fy = y + 4 + row * 9
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(field.label.toUpperCase(), x, fy)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(24, 24, 27)
    const value = doc.splitTextToSize(field.value || '-', colW - 4) as string[]
    doc.text(value[0] ?? '', x, fy + 3.6)
  })
  y += boxH + 4

  const otrosCount = input.otrosEtiquetas.length
  const totalCols = 12 + otrosCount * 2
  const layout = tableLayout(otrosCount, contentWidth)
  const headGroup: CellInput[] = [
    { content: 'Cuota', rowSpan: 2, styles: { valign: 'bottom', halign: 'center' } },
    { content: 'Fecha', rowSpan: 2, styles: { valign: 'bottom', halign: 'left' } },
    { content: 'Capital', colSpan: 2, styles: { halign: 'center' } },
    { content: 'Intereses', colSpan: 2, styles: { halign: 'center' } },
    ...input.otrosEtiquetas.map((etiqueta) => ({ content: etiqueta, colSpan: 2, styles: { halign: 'center' as const } })),
    { content: 'Mora', colSpan: 2, styles: { halign: 'center' } },
    { content: 'Totales', colSpan: 2, styles: { halign: 'center' } },
    { content: 'Saldo', rowSpan: 2, styles: { valign: 'bottom', halign: 'right' } },
    { content: 'Estado', rowSpan: 2, styles: { valign: 'bottom', halign: 'center' } },
  ]
  const headSub: CellInput[] = []
  const groups = 4 + otrosCount
  for (let i = 0; i < groups; i++) {
    headSub.push(
      { content: 'Monto', styles: { halign: 'right' } },
      { content: 'Pagado', styles: { halign: 'right' } },
    )
  }

  const detailCells = (r: PlanPagoPdfRow): CellInput[] => [
    { content: String(r.cuota), styles: { halign: 'center' } },
    { content: fmtDate(r.fecha), styles: { halign: 'left' } },
    ...pair(r.capital, r.capital_pagado),
    ...pair(r.interes, r.interes_pagado),
    ...r.otrosForRow.flatMap((o) => pair(o.monto, o.monto_pagado)),
    ...pair(r.mora, r.mora_pagado),
    ...pair(r.cuotaMonto, r.cuotaPagado, true),
    { content: fmtNum(r.saldo), styles: { halign: 'right', fontStyle: 'bold' } },
    { content: ESTADO_LABEL[r.estado] ?? String(r.estado), styles: { halign: 'center' } },
  ]

  const totalCells = (label: string, t: Totales): CellInput[] => [
    { content: label, colSpan: 2, styles: { halign: 'left', fontStyle: 'bold' } },
    ...pair(t.capital, t.capital_pagado, true),
    ...pair(t.interes, t.interes_pagado, true),
    ...t.otros.flatMap((o) => pair(o.monto, o.monto_pagado, true)),
    ...pair(t.mora, t.mora_pagado, true),
    ...pair(t.cuotaMonto, t.cuotaPagado, true),
    { content: fmtNum(t.saldo), styles: { halign: 'right', fontStyle: 'bold' } },
    '',
  ]

  const sectionRow = (label: string): RowInput => [{
    content: label,
    colSpan: totalCols,
    styles: { fillColor: FILL_SECTION, textColor: TEXT_SECTION, fontStyle: 'bold', halign: 'left' },
  }]

  const emptyRow = (label: string): RowInput => [{
    content: label,
    colSpan: totalCols,
    styles: { halign: 'center', textColor: TEXT_MUTED, fontStyle: 'normal' },
  }]

  const totalEnganche = sumRows(input.engancheRows, otrosCount)
  const totalFinanciamiento = sumRows(input.financiamientoRows, otrosCount)
  const totalGeneral = sumRows([...input.engancheRows, ...input.financiamientoRows], otrosCount)

  const body: RowInput[] = [
    sectionRow('Enganche'),
    ...(input.engancheRows.length === 0 ? [emptyRow('Sin cuotas de enganche')] : input.engancheRows.map(detailCells)),
    paint(totalCells('Total Enganche', totalEnganche), FILL_TOTAL),
    sectionRow('Financiamiento'),
    ...(input.financiamientoRows.length === 0 ? [emptyRow('Sin cuotas de financiamiento')] : input.financiamientoRows.map(detailCells)),
    paint(totalCells('Total Financiamiento', totalFinanciamiento), FILL_TOTAL),
  ]

  autoTable(doc, {
    startY: y,
    margin: { top: 14, right: MARGIN_X, bottom: MARGIN_BOTTOM, left: MARGIN_X },
    tableWidth: contentWidth,
    showHead: 'everyPage',
    showFoot: 'lastPage',
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: layout.fontSize,
      cellPadding: layout.cellPadding,
      textColor: [24, 24, 27],
      lineColor: LINE,
      lineWidth: 0.1,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [250, 250, 250],
      textColor: [63, 63, 70],
      fontStyle: 'bold',
      fontSize: layout.headFontSize,
    },
    columnStyles: layout.columnStyles,
    footStyles: {
      fillColor: FILL_GRAND,
      textColor: [24, 24, 27],
      fontStyle: 'bold',
    },
    head: [headGroup, headSub],
    body,
    foot: [paint(totalCells('TOTALES', totalGeneral), FILL_GRAND)],
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== totalCols - 1) return
      const label = data.cell.text.join('')
      const color = ESTADO_COLOR[label]
      if (color) data.cell.styles.textColor = color
    },
    willDrawPage: (data) => {
      if (data.pageNumber === 1) return
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(24, 24, 27)
      doc.text(title, MARGIN_X, 9)
    },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(`${i} / ${pageCount}`, pageWidth - MARGIN_X, pageHeight - 6, { align: 'right' })
  }

  doc.save(`plan_pagos-${input.proyecto}-${input.numero}.pdf`)
}
