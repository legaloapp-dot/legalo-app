# LÉGALO APP - MVP

Plataforma que diagnostica problemas legales en Venezuela usando IA y conecta usuarios con abogados verificados.

## Stack Técnico

- **Mobile**: React Native (Expo) + TypeScript
- **Admin**: Next.js + Tailwind CSS
- **Backend**: Supabase (Auth, DB, Storage)
- **IA**: Gemini API

## Estructura del Proyecto

```
Legalo/
├── mobile/          # App móvil (Expo)
├── admin/           # Panel de administración (Next.js)
├── supabase/        # Esquema SQL y migraciones
└── package.json     # Scripts del monorepo
```

## Instalación

### 1. Dependencias (ya instaladas)

```bash
npm run install:all
```

### 2. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard)
2. Ejecuta el esquema en `supabase/schema.sql` en el SQL Editor
3. Copia las variables de entorno:

**Mobile** (`mobile/.env`):
```env
EXPO_PUBLIC_SUPABASE_URL=tu_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=tu_gemini_key
```

**Admin** (`admin/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

### 3. Ejecutar

```bash
# App móvil
npm run mobile

# Panel admin
npm run admin
```

## Próximos pasos

- [ ] Pantalla de Login y selector de roles
- [ ] Chatbot IA con Gemini
- [ ] Matchmaking de abogados
- [ ] Flujo de pago y escrow
- [ ] Dashboard admin
