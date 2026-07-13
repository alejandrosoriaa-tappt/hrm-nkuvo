-- Actualización de sitio_web para 16 reclutadoras que no lo tenían.
-- Verificado por búsqueda web el 13 jul 2026 — 5 no tienen sitio propio
-- confirmable (Insourcing Professional Services, Ecco México, A&F Estrategas,
-- Narus, Team Solution México) y se dejan como estaban, sin inventar URL.
-- Correr en la consola de Railway/Postgres: psql $DATABASE_URL

UPDATE hrm_recruiters SET sitio_web = 'https://outhelping.mx' WHERE nombre = 'Out Helping Corporativo';
UPDATE hrm_recruiters SET sitio_web = 'https://outhelping.mx' WHERE nombre = 'Out Helping (Centro de Reclutamiento, Parque Industrial Querétaro)';
UPDATE hrm_recruiters SET sitio_web = 'https://outhelping.mx' WHERE nombre = 'Out Helping (sucursal FINSA, El Marqués)';
UPDATE hrm_recruiters SET sitio_web = 'https://outhelping.mx' WHERE nombre = 'Out Helping (sucursal Marqués)';
UPDATE hrm_recruiters SET sitio_web = 'https://lmaservices.com' WHERE nombre = 'LMA Services';
UPDATE hrm_recruiters SET sitio_web = 'https://www.workenqueretaro.com' WHERE nombre = 'Worken';
UPDATE hrm_recruiters SET sitio_web = 'https://www.brainware.com.mx' WHERE nombre = 'Brainware Assistance & Engineering';
UPDATE hrm_recruiters SET sitio_web = 'https://oirh.mx' WHERE nombre = 'OIRH';
UPDATE hrm_recruiters SET sitio_web = 'https://ciceso.mx' WHERE nombre = 'CICESO Centro Integral de Evaluación';
UPDATE hrm_recruiters SET sitio_web = 'https://www.serpac.mx' WHERE nombre = 'Serpac Consulting';
UPDATE hrm_recruiters SET sitio_web = 'https://www.peoplecare.mx' WHERE nombre = 'People Care';
UPDATE hrm_recruiters SET sitio_web = 'https://www.lumipeople.com' WHERE nombre = 'Lumi Sourcing';
UPDATE hrm_recruiters SET sitio_web = 'https://www.soraaconsultores.com' WHERE nombre = 'Soraa Consultores';
UPDATE hrm_recruiters SET sitio_web = 'https://www.tasisoluciones.com' WHERE nombre = 'TASI Soluciones en Capital Humano e IT';
UPDATE hrm_recruiters SET sitio_web = 'https://www.sercah.com.mx' WHERE nombre = 'Sercah Consultores';
UPDATE hrm_recruiters SET sitio_web = 'https://personaeconsultores.com' WHERE nombre = 'Personae Consultores';
