# LÉGALO — Panel administrador

Next.js 16 (App Router), Tailwind 4, plantilla tipo **dashboard** (sidebar oscuro, superficie clara, acentos índigo, tipografía **Plus Jakarta Sans**).

## Configuración

1. Copia `.env.example` a `.env.local` y completa:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (solo servidor; no publicar)

2. Crea el **superadmin** (recomendado):
   ```bash
   cd admin
   npm run create-superadmin
   ```
   Por defecto usa `superadmin@legalo.app` / `Legal0SuperAdmin!` (cámbialo con variables `SUPERADMIN_*` en `.env.local`). Si el correo ya existe, solo actualiza el perfil a `admin`.

   **Alternativa manual:** en Supabase → `profiles`, pon `role = 'admin'` para tu usuario.

3. Arranca el panel:

```bash
cd admin
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con el correo del admin.

## Áreas

- **Resumen**: métricas rápidas.
- **Clientes**: CRUD (creación vía Auth Admin + perfil).
- **Abogados**: CRUD; **detalle** con documentos (INPRE/cédula), aprobar/desaprobar verificación.
- **Pagos**: listado con comprobante (URL firmada) y aprobar / rechazar / pendiente.

Las operaciones sensibles usan la **service role** en Server Actions tras comprobar sesión y rol `admin` en middleware.
