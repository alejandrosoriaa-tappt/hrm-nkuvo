// Descarga un CV de Supabase Storage y extrae su texto plano (PDF o DOCX).
// Compartido entre el ATS check y la reescritura con IA.
export async function extractCvText(supabase, cv) {
  const { data: fileData, error: dlErr } = await supabase.storage
    .from('cvs')
    .download(cv.storage_path)
  if (dlErr) throw new Error('No se pudo descargar el CV')

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const ext = cv.storage_path.split('.').pop().toLowerCase()

  if (ext === 'pdf') {
    // pdf-parse importado dinámicamente para evitar el warning del constructor
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const result = await pdfParse(buffer)
    return result.text
  }
  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }
  throw new Error('Formato de archivo no soportado')
}
