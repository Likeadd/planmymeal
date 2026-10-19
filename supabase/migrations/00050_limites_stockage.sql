-- Audit VULN-015 : défense en profondeur sur le bucket public des photos de recettes
-- (aucun envoi n'est possible hors clé de service, mais une erreur de policy future ne doit pas
-- permettre d'y déposer des fichiers lourds ou d'un autre type).
update storage.buckets
set file_size_limit = 5242880,  -- 5 Mo
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id = 'meal-images';
