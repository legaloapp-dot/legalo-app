/**
 * Sugerencias de dirección/lugar vía Photon (datos OpenStreetMap).
 * Sin API key; uso razonable con debounce en la UI.
 */

export interface PlaceSuggestion {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

/** Centro aproximado Venezuela (sesgo de resultados hacia el país). */
const BIAS_LAT = 10.48;
const BIAS_LON = -66.9;

function buildLabelFromProperties(p: Record<string, unknown>): string {
  const name = String(p.name ?? '').trim();
  const street = [p.housenumber, p.street]
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x).trim())
    .join(' ')
    .trim();
  const locality = String(
    p.city ?? p.town ?? p.district ?? p.village ?? p.suburb ?? ''
  ).trim();
  const state = String(p.state ?? '').trim();
  const country = String(p.country ?? '').trim();

  if (street && locality) {
    return [street, locality, state, country].filter(Boolean).join(', ');
  }
  if (name && locality && name.toLowerCase() !== locality.toLowerCase()) {
    return [name, locality, state, country].filter(Boolean).join(', ');
  }
  if (locality) {
    return [locality, state, country].filter(Boolean).join(', ');
  }
  if (name) {
    return [name, country].filter(Boolean).join(', ');
  }
  return 'Ubicación';
}

export async function searchPlacesAutocomplete(
  query: string,
  signal?: AbortSignal
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    limit: '8',
    lang: 'es',
    lat: String(BIAS_LAT),
    lon: String(BIAS_LON),
  });

  const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'LegaloApp/1.0 (contacto legalo; busqueda direccion)',
    },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: number[] };
      properties?: Record<string, unknown>;
    }>;
  };

  const out: PlaceSuggestion[] = [];
  const features = data.features ?? [];

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const lon = coords[0];
    const lat = coords[1];
    if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) {
      continue;
    }
    const props = f.properties ?? {};
    const label = buildLabelFromProperties(props);
    const osmId = props.osm_id != null ? String(props.osm_id) : `${i}`;
    out.push({
      id: `${osmId}-${lat.toFixed(4)}-${lon.toFixed(4)}`,
      label,
      latitude: lat,
      longitude: lon,
    });
  }

  return out;
}
