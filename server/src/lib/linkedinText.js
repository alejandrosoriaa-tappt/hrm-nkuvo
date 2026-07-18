// Extrae texto plano de un perfil de LinkedIn: desde un PDF exportado por el
// propio usuario (bucket 'linkedin' de Supabase Storage) o desde texto que
// el usuario pegó directamente. Mismo patrón que cvText.js.
export async function extractLinkedinText(supabase, profile) {
  if (!profile.storage_path) {
    return profile.raw_text || ''
  }

  const { data: fileData, error: dlErr } = await supabase.storage
    .from('linkedin')
    .download(profile.storage_path)
  if (dlErr) throw new Error('No se pudo descargar el PDF de LinkedIn')

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
  const result = await pdfParse(buffer)
  return result.text
}
