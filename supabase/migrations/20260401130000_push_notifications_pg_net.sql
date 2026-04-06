-- Habilitar pg_net para llamadas HTTP desde triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Constantes compartidas
DO $$
BEGIN
  -- URL base del proyecto (no secreta)
  PERFORM set_config('app.supabase_url', 'https://qufazyzesquubkmrhyfk.supabase.co', false);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ABOGADOS: notify_lawyer_on_verification
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_lawyer_on_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_title text := 'Cuenta verificada';
  v_body  text := 'Tu perfil de abogado fue aprobado. Ya puedes usar la app con todas las funciones.';
BEGIN
  IF new.role = 'lawyer'
     AND coalesce(old.is_verified, false) = false
     AND new.is_verified = true
  THEN
    INSERT INTO public.lawyer_notifications (lawyer_id, type, title, body)
    VALUES (new.id, 'account_approved', v_title, v_body);

    PERFORM net.http_post(
      url     := 'https://qufazyzesquubkmrhyfk.supabase.co/functions/v1/send-expo-push',
      body    := jsonb_build_object('record', jsonb_build_object(
                   'user_id', new.id,
                   'title',   v_title,
                   'body',    v_body,
                   'type',    'account_approved'
                 )),
      headers := jsonb_build_object(
                   'Content-Type',          'application/json',
                   'x-legalo-webhook-secret', 'c4feebcc-8d21-4798-b509-c16290beec3e'
                 )
    );
  END IF;
  RETURN new;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ABOGADOS: notify_lawyer_on_new_case
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_lawyer_on_new_case()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_title text;
  v_body  text;
BEGIN
  IF new.status = 'awaiting_payment' THEN RETURN new; END IF;

  v_title := 'Nueva solicitud de caso';
  v_body  := trim(
    coalesce(new.client_display_name, 'Un cliente')
    || ' envió el caso: '
    || coalesce(new.title, 'Sin título')
  );

  INSERT INTO public.lawyer_notifications (lawyer_id, type, title, body, ref_id)
  VALUES (new.lawyer_id, 'new_case', v_title, v_body, new.id);

  PERFORM net.http_post(
    url     := 'https://qufazyzesquubkmrhyfk.supabase.co/functions/v1/send-expo-push',
    body    := jsonb_build_object('record', jsonb_build_object(
                 'user_id', new.lawyer_id,
                 'title',   v_title,
                 'body',    v_body,
                 'type',    'new_case'
               )),
    headers := jsonb_build_object(
                 'Content-Type',          'application/json',
                 'x-legalo-webhook-secret', 'c4feebcc-8d21-4798-b509-c16290beec3e'
               )
  );
  RETURN new;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ABOGADOS: notify_lawyer_on_new_lead
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_lawyer_on_new_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_title text := 'Nueva solicitud de contacto';
  v_body  text;
BEGIN
  v_body := trim(
    coalesce(new.client_name, 'Un cliente')
    || ' te envió una consulta'
    || CASE WHEN new.category IS NOT NULL AND length(trim(new.category)) > 0
       THEN ' · ' || trim(new.category) ELSE '' END
  );

  INSERT INTO public.lawyer_notifications (lawyer_id, type, title, body, ref_id)
  VALUES (new.lawyer_id, 'new_lead', v_title, v_body, new.id);

  PERFORM net.http_post(
    url     := 'https://qufazyzesquubkmrhyfk.supabase.co/functions/v1/send-expo-push',
    body    := jsonb_build_object('record', jsonb_build_object(
                 'user_id', new.lawyer_id,
                 'title',   v_title,
                 'body',    v_body,
                 'type',    'new_lead'
               )),
    headers := jsonb_build_object(
                 'Content-Type',          'application/json',
                 'x-legalo-webhook-secret', 'c4feebcc-8d21-4798-b509-c16290beec3e'
               )
  );
  RETURN new;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ABOGADOS: notify_lawyer_on_case_rated
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_lawyer_on_case_rated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_title text;
  v_body  text;
BEGIN
  IF tg_op = 'UPDATE'
     AND old.status = 'active'
     AND new.status = 'closed'
     AND old.client_rating IS NULL
     AND new.client_rating IS NOT NULL
     AND new.client_rating BETWEEN 1 AND 5
  THEN
    v_title := 'Caso finalizado y calificado';
    v_body  :=
      'El cliente cerró el caso «'
      || left(trim(coalesce(new.title, 'Sin título')), 120)
      || '» con '
      || new.client_rating::text
      || CASE WHEN new.client_rating = 1 THEN ' estrella' ELSE ' estrellas' END
      || '.'
      || CASE
           WHEN new.client_rating_comment IS NOT NULL
                AND length(trim(new.client_rating_comment)) > 0
           THEN ' Comentario: ' || left(trim(new.client_rating_comment), 300)
           ELSE ''
         END;

    INSERT INTO public.lawyer_notifications (lawyer_id, type, title, body, ref_id)
    VALUES (new.lawyer_id, 'case_rated', v_title, v_body, new.id);

    PERFORM net.http_post(
      url     := 'https://qufazyzesquubkmrhyfk.supabase.co/functions/v1/send-expo-push',
      body    := jsonb_build_object('record', jsonb_build_object(
                   'user_id', new.lawyer_id,
                   'title',   v_title,
                   'body',    v_body,
                   'type',    'case_rated'
                 )),
      headers := jsonb_build_object(
                   'Content-Type',          'application/json',
                   'x-legalo-webhook-secret', 'c4feebcc-8d21-4798-b509-c16290beec3e'
                 )
    );
  END IF;
  RETURN new;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENTES: notify_client_on_transaction_status
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_client_on_transaction_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_title text;
  v_body  text;
  v_type  text;
BEGIN
  IF coalesce(new.purpose, 'case_contact') <> 'case_contact' THEN RETURN new; END IF;

  IF tg_op = 'UPDATE' AND new.status IS DISTINCT FROM old.status THEN
    IF new.status = 'approved' AND coalesce(old.status, '') IS DISTINCT FROM 'approved' THEN
      v_title := 'Pago confirmado';
      v_body  := 'Tu comprobante fue aprobado. El abogado podrá revisar tu caso cuando corresponda.';
      v_type  := 'payment_approved';
    ELSIF new.status = 'rejected' AND coalesce(old.status, '') IS DISTINCT FROM 'rejected' THEN
      v_title := 'Pago no verificado';
      v_body  := 'Tu comprobante no fue aprobado. Revisa la pestaña Pagos o sube un nuevo comprobante.';
      v_type  := 'payment_rejected';
    END IF;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.client_notifications (client_id, type, title, body, ref_id)
      VALUES (new.client_id, v_type, v_title, v_body, new.id);

      PERFORM net.http_post(
        url     := 'https://qufazyzesquubkmrhyfk.supabase.co/functions/v1/send-expo-push',
        body    := jsonb_build_object('record', jsonb_build_object(
                     'user_id', new.client_id,
                     'title',   v_title,
                     'body',    v_body,
                     'type',    v_type
                   )),
        headers := jsonb_build_object(
                     'Content-Type',          'application/json',
                     'x-legalo-webhook-secret', 'c4feebcc-8d21-4798-b509-c16290beec3e'
                   )
      );
    END IF;
  END IF;
  RETURN new;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENTES: notify_client_on_case_decision
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_client_on_case_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_title text;
  v_body  text;
  v_type  text;
BEGIN
  IF tg_op = 'UPDATE' AND new.status IS DISTINCT FROM old.status THEN
    IF old.status = 'pending_approval' AND new.status = 'active' THEN
      v_title := 'Caso aceptado';
      v_body  := 'El abogado aceptó tu caso «'
                 || left(trim(coalesce(new.title, 'Sin título')), 120)
                 || '». Ya puedes contactarle por WhatsApp desde Mis casos.';
      v_type  := 'case_accepted';
    ELSIF old.status = 'pending_approval'
          AND new.status IN ('reassignment_pending', 'rejected_by_lawyer') THEN
      v_title := 'Caso no aceptado';
      v_body  := 'El abogado no aceptó tomar tu caso «'
                 || left(trim(coalesce(new.title, 'Sin título')), 120)
                 || '». En Mis casos puedes activar un cupón de conexión o solicitar reembolso.';
      v_type  := 'case_rejected';
    END IF;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.client_notifications (client_id, type, title, body, ref_id)
      VALUES (new.client_id, v_type, v_title, v_body, new.id);

      PERFORM net.http_post(
        url     := 'https://qufazyzesquubkmrhyfk.supabase.co/functions/v1/send-expo-push',
        body    := jsonb_build_object('record', jsonb_build_object(
                     'user_id', new.client_id,
                     'title',   v_title,
                     'body',    v_body,
                     'type',    v_type
                   )),
        headers := jsonb_build_object(
                   'Content-Type',          'application/json',
                   'x-legalo-webhook-secret', 'c4feebcc-8d21-4798-b509-c16290beec3e'
                 )
      );
    END IF;
  END IF;
  RETURN new;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENTES: notify_client_on_connection_coupon
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_client_on_connection_coupon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_title text := 'Cupón de conexión';
  v_body  text;
BEGIN
  IF tg_op = 'INSERT' AND new.status = 'open' AND new.source_case_id IS NOT NULL THEN
    v_body := 'Tienes un cupón para contactar a otro abogado de la especialidad «'
              || left(trim(coalesce(new.specialty, '')), 80)
              || '» sin pagar de nuevo el fee. Úsalo en el directorio.';

    INSERT INTO public.client_notifications (client_id, type, title, body, ref_id)
    VALUES (new.client_id, 'connection_coupon', v_title, v_body, new.id);

    PERFORM net.http_post(
      url     := 'https://qufazyzesquubkmrhyfk.supabase.co/functions/v1/send-expo-push',
      body    := jsonb_build_object('record', jsonb_build_object(
                   'user_id', new.client_id,
                   'title',   v_title,
                   'body',    v_body,
                   'type',    'connection_coupon'
                 )),
      headers := jsonb_build_object(
                   'Content-Type',          'application/json',
                   'x-legalo-webhook-secret', 'c4feebcc-8d21-4798-b509-c16290beec3e'
                 )
    );
  END IF;
  RETURN new;
END;
$$;
