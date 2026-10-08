-- La clase de una fecha pasa a describirse sola: su semana, su hora, su estilo y su nivel.
-- Generada con drizzle-kit y editada a mano: las columnas nuevas se completan desde el horario
-- antes de volverse obligatorias.

ALTER TABLE "clase" DROP CONSTRAINT "clase_horario_fecha_uq";--> statement-breakpoint
ALTER TABLE "clase" ALTER COLUMN "horario_id" DROP NOT NULL;--> statement-breakpoint

-- Los horarios que ya existen rigen desde el lunes de la semana de la migración, en la zona del estudio.
ALTER TABLE "horario" ADD COLUMN "vigente_desde" date;--> statement-breakpoint
UPDATE "horario" SET "vigente_desde" = date_trunc('week', (now() at time zone 'America/Argentina/Buenos_Aires'))::date;--> statement-breakpoint
ALTER TABLE "horario" ALTER COLUMN "vigente_desde" SET NOT NULL;--> statement-breakpoint

-- Las clases que ya existen copian la hora, el estilo y el nivel de su horario.
ALTER TABLE "clase" ADD COLUMN "semana" date;--> statement-breakpoint
ALTER TABLE "clase" ADD COLUMN "hora_inicio" time;--> statement-breakpoint
ALTER TABLE "clase" ADD COLUMN "hora_fin" time;--> statement-breakpoint
ALTER TABLE "clase" ADD COLUMN "estilo" text;--> statement-breakpoint
ALTER TABLE "clase" ADD COLUMN "nivel" text;--> statement-breakpoint
UPDATE "clase" SET
  "semana" = "clase"."fecha" - (extract(isodow from "clase"."fecha")::int - 1),
  "hora_inicio" = "horario"."hora_inicio",
  "hora_fin" = "horario"."hora_fin",
  "estilo" = "horario"."estilo",
  "nivel" = "horario"."nivel"
FROM "horario"
WHERE "horario"."id" = "clase"."horario_id";--> statement-breakpoint
ALTER TABLE "clase" ALTER COLUMN "semana" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clase" ALTER COLUMN "hora_inicio" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clase" ALTER COLUMN "hora_fin" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clase" ALTER COLUMN "estilo" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "clase" ADD CONSTRAINT "clase_horario_semana_uq" UNIQUE("horario_id","semana");--> statement-breakpoint
ALTER TABLE "horario" ADD CONSTRAINT "horario_vigente_desde_lunes" CHECK (extract(isodow from "horario"."vigente_desde") = 1);--> statement-breakpoint
ALTER TABLE "clase" ADD CONSTRAINT "clase_horas_validas" CHECK ("clase"."hora_fin" > "clase"."hora_inicio");--> statement-breakpoint
ALTER TABLE "clase" ADD CONSTRAINT "clase_semana_lunes" CHECK (extract(isodow from "clase"."semana") = 1);--> statement-breakpoint
ALTER TABLE "clase" ADD CONSTRAINT "clase_fecha_en_semana" CHECK ("clase"."fecha" between "clase"."semana" and "clase"."semana" + 6);
