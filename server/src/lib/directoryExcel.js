import ExcelJS from 'exceljs'

/**
 * Arma el Excel del directorio completo (misma tabla en vivo hrm_recruiters
 * para todos los que lo generan). Compartido entre el flujo anónimo (compra
 * suelta con solo correo) y el botón de descarga dentro de la app.
 * @param {string} watermarkLabel - identifica quién descargó (correo o "user_id: ...")
 */
export async function buildDirectoryWorkbook(supabase, watermarkLabel) {
  const { data: recruitersRaw, error } = await supabase
    .from('hrm_recruiters')
    .select('nombre, industria, sitio_web, email, telefono, ciudad')
    .order('nombre', { ascending: true })
  if (error) throw new Error(error.message)

  // Orden por completitud de datos (pedido explícito): primero las que
  // tienen sitio web + teléfono + correo, luego las que solo tienen sitio
  // web (sin teléfono y/o correo), al final el resto (solo teléfono, sin
  // sitio web). Dentro de cada grupo se mantiene el orden alfabético.
  const hasVal = (v) => Boolean(v && String(v).trim())
  const tierOf = (r) => {
    const hasWeb = hasVal(r.sitio_web)
    const hasPhone = hasVal(r.telefono)
    const hasEmail = hasVal(r.email)
    if (hasWeb && hasPhone && hasEmail) return 0
    if (hasWeb) return 1
    return 2
  }
  const recruiters = [...(recruitersRaw || [])].sort((a, b) => tierOf(a) - tierOf(b))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'HRM NKUVO'
  const ws = wb.addWorksheet('Directorio de Reclutadoras')

  // Sin logo/imagen embebida a propósito — todo el look de marca (banda
  // verde, tipografía) se logra con formato de celdas, así el archivo pesa
  // menos y el texto se mantiene seleccionable/buscable.
  ws.columns = [
    { key: 'id',        width: 6 },
    { key: 'nombre',    width: 32 },
    { key: 'sitio_web', width: 30 },
    { key: 'telefono',  width: 20 },
    { key: 'email',     width: 30 },
    { key: 'ciudad',    width: 26 },
    { key: 'industria', width: 34 },
  ]

  // Fila 1 — banner de título (verde oscuro, combinada A1:G1)
  ws.mergeCells('A1:G1')
  ws.getRow(1).height = 28
  const titleCell = ws.getCell('A1')
  titleCell.value = 'Directorio de reclutadoras y agencias verificadas en México'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  // Fila 2 — banner de subtítulo (verde, combinada A2:G2)
  ws.mergeCells('A2:G2')
  ws.getRow(2).height = 18
  const fechaLegible = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  const subtitleCell = ws.getCell('A2')
  subtitleCell.value = `Actualizado: ${fechaLegible}  ·  Total de registros: ${(recruiters || []).length}`
  subtitleCell.font = { size: 10, color: { argb: 'FFFFFFFF' } }
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } }
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  // Fila 3 — encabezados de columna
  const headerRow = ws.getRow(3)
  headerRow.values = ['ID', 'Reclutadora', 'Sitio web', 'Teléfono', 'Correo', 'Ciudad', 'Industria']
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } }
    cell.alignment = { vertical: 'middle' }
  })
  ws.views = [{ state: 'frozen', ySplit: 3 }]

  ;(recruiters || []).forEach((r, i) => {
    const row = ws.addRow({
      id:        i + 1,
      nombre:    r.nombre    || '',
      sitio_web: r.sitio_web ? { text: r.sitio_web, hyperlink: r.sitio_web } : '',
      telefono:  r.telefono  || '',
      email:     r.email     || '',
      ciudad:    r.ciudad    || '',
      industria: r.industria || '',
    })
    if (i % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3EC' } }
      })
    }
    row.getCell('sitio_web').font = { color: { argb: 'FF16A34A' }, underline: true }
  })

  // Marca de agua de trazabilidad — no evita compartirlo, pero identifica
  // de qué compra/cuenta salió si aparece circulando.
  const wmSheet = wb.addWorksheet('Info de descarga')
  wmSheet.columns = [{ key: 'k', width: 22 }, { key: 'v', width: 50 }]
  wmSheet.addRow({ k: 'Descargado por', v: watermarkLabel })
  wmSheet.addRow({ k: 'Fecha de descarga', v: new Date().toLocaleString('es-MX') })
  wmSheet.addRow({ k: '', v: 'Este archivo es para uso personal. Directorio HRM NKUVO — hrm.nkuvo.com' })

  return wb
}
