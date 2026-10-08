-- Lo que se repite cada semana pasa a llamarse horario, y la clase de una fecha deja de llamarse sesión.
-- Escrita a mano: drizzle-kit pregunta en la terminal si un cambio es un renombre. Solo cambian nombres,
-- no se mueve ninguna fila. El orden importa: "clase" tiene que quedar libre antes de renombrar "sesion".

ALTER TABLE "clase" RENAME TO "horario";--> statement-breakpoint
ALTER TABLE "horario" RENAME COLUMN "activa" TO "activo";--> statement-breakpoint
ALTER TABLE "horario" RENAME CONSTRAINT "clase_pkey" TO "horario_pkey";--> statement-breakpoint
ALTER TABLE "horario" RENAME CONSTRAINT "clase_dia_valido" TO "horario_dia_valido";--> statement-breakpoint
ALTER TABLE "horario" RENAME CONSTRAINT "clase_horario_valido" TO "horario_horas_validas";--> statement-breakpoint
ALTER TABLE "horario" RENAME CONSTRAINT "clase_profesor_id_profesor_id_fk" TO "horario_profesor_id_profesor_id_fk";--> statement-breakpoint
ALTER SEQUENCE "clase_id_seq" RENAME TO "horario_id_seq";--> statement-breakpoint

ALTER TABLE "sesion" RENAME TO "clase";--> statement-breakpoint
ALTER TABLE "clase" RENAME COLUMN "clase_id" TO "horario_id";--> statement-breakpoint
ALTER TABLE "clase" RENAME CONSTRAINT "sesion_pkey" TO "clase_pkey";--> statement-breakpoint
ALTER TABLE "clase" RENAME CONSTRAINT "sesion_clase_fecha_uq" TO "clase_horario_fecha_uq";--> statement-breakpoint
ALTER TABLE "clase" RENAME CONSTRAINT "sesion_clase_id_clase_id_fk" TO "clase_horario_id_horario_id_fk";--> statement-breakpoint
ALTER TABLE "clase" RENAME CONSTRAINT "sesion_profesor_id_profesor_id_fk" TO "clase_profesor_id_profesor_id_fk";--> statement-breakpoint
ALTER INDEX "sesion_profesor_fecha_idx" RENAME TO "clase_profesor_fecha_idx";--> statement-breakpoint
ALTER SEQUENCE "sesion_id_seq" RENAME TO "clase_id_seq";--> statement-breakpoint
ALTER TYPE "public"."estado_sesion" RENAME TO "estado_clase";--> statement-breakpoint

ALTER TABLE "asistencia" RENAME COLUMN "sesion_id" TO "clase_id";--> statement-breakpoint
ALTER TABLE "asistencia" RENAME CONSTRAINT "asistencia_sesion_alumno_uq" TO "asistencia_clase_alumno_uq";--> statement-breakpoint
ALTER TABLE "asistencia" RENAME CONSTRAINT "asistencia_sesion_id_sesion_id_fk" TO "asistencia_clase_id_clase_id_fk";
