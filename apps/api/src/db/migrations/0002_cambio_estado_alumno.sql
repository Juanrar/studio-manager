CREATE TABLE "cambio_estado_alumno" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cambio_estado_alumno_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"alumno_id" bigint NOT NULL,
	"activo" boolean NOT NULL,
	"registrado_por" bigint,
	"registrado_en" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cambio_estado_alumno" ADD CONSTRAINT "cambio_estado_alumno_alumno_id_alumno_id_fk" FOREIGN KEY ("alumno_id") REFERENCES "public"."alumno"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cambio_estado_alumno" ADD CONSTRAINT "cambio_estado_alumno_registrado_por_usuario_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cambio_estado_alumno_alumno_idx" ON "cambio_estado_alumno" USING btree ("alumno_id","registrado_en");