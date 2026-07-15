-- Conciliación 14 jul 2026 — reconciliar hrm_recruiters con la revisión
-- del usuario (directorio_reclutadoras_hrm AS Jul 14.xlsx): elimina 6 filas
-- marcadas en rojo (datos de contacto incorrectos) y agrega 7 filas nuevas
-- marcadas en verde. Total resultante: 147.
--
-- A propósito NO se usa TRUNCATE + reinsert completo: hrm_contacts tiene FK
-- a hrm_recruiters.id con ON DELETE CASCADE — regenerar todos los UUIDs
-- borraría el seguimiento de contacto real de cualquier usuario de la app.
-- Se corre en Supabase SQL Editor.

-- 1) Eliminar registros marcados en rojo (dato de contacto incorrecto)
delete from hrm_recruiters where nombre = 'Velázquez';
delete from hrm_recruiters where nombre = 'Grupo CYH Corporativo';
delete from hrm_recruiters where nombre = 'Grupo Maas Recursos Humanos';
delete from hrm_recruiters where nombre = 'Labor Mexicana';
delete from hrm_recruiters where nombre = 'Ecco México';
delete from hrm_recruiters where nombre = 'A&F Estrategas';

-- 2) Agregar registros marcados en verde
insert into hrm_recruiters (nombre, industria, sitio_web, email, telefono, ciudad, fuente, estado)
values
  ('Escala Negocios', 'Generalista CDMX', 'https://consultoriaparaempresa.com/', null, '8116782539', 'CDMX', 'Curado', 'Activo'),
  ('ISPROX', 'Generalista CDMX', 'https://isprox.com/', null, null, 'CDMX', 'Curado', 'Activo'),
  ('FORHUMAN', 'Generalista CDMX', 'https://forhuman.mx/', 'contacto@forhuman.mx', '5555013070', 'CDMX', 'Curado', 'Activo'),
  ('ALIATO', 'Generalista CDMX', 'https://www.aliato.mx/', 'contacto@aliato.mx', '55 5080 5800', 'CDMX', 'Curado', 'Activo'),
  ('OVERCAST', 'Generalista CDMX', 'https://overcastmx.com/', 'comercial@overcastmx.com', '55 8874 7400', 'CDMX', 'Curado', 'Activo'),
  ('TOTUM TALENT', 'Generalista MTY', 'https://totumtalent.com/', 'contacto@totumtalent.com', '8134408467', 'MTY', 'Curado', 'Activo');

-- Verificación
select count(*) from hrm_recruiters;