-- Ubicación del consultorio del abogado (coordenadas + etiqueta legible para el directorio)

alter table public.profiles
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_label text;

comment on column public.profiles.latitude is 'Latitud WGS84 del consultorio (opcional)';
comment on column public.profiles.longitude is 'Longitud WGS84 del consultorio (opcional)';
comment on column public.profiles.location_label is 'Ciudad/zona legible mostrada en el directorio';
