// Compartido entre DirectorioLandingPage y DirectorioGraciasPage. El checkout
// dinámico vía la API de Clip ya regresa el order_ref por query string
// (redirection_url.success), pero esto queda como respaldo por si el
// comprador llega a /directorio/gracias sin ese parámetro (link viejo,
// navegador que lo recorta, etc.).
export const ORDER_REF_KEY = 'hrm_directory_order_ref'
