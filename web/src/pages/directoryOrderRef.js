// Compartido entre DirectorioLandingPage y DirectorioGraciasPage: el link de
// pago de Clip es un checkout hospedado de una sola URL fija, así que no hay
// garantía de que nos regrese el order_ref por query string — se persiste
// aquí antes de redirigir para leerlo de vuelta al volver de Clip.
export const ORDER_REF_KEY = 'hrm_directory_order_ref'
