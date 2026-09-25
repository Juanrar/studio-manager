CREATE TYPE "public"."estado_sesion" AS ENUM('programada', 'dictada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."medio_pago" AS ENUM('efectivo', 'transferencia', 'mercado_pago', 'otro');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('admin', 'recepcion');--> statement-breakpoint
CREATE TABLE "alumno" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alumno_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"apellido" text NOT NULL,
	"dni" text,
	"email" text,
	"telefono" text,
	"fecha_nacimiento" date,
	"contacto_emergencia" text,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alumno_dni_unique" UNIQUE("dni")
);
--> statement-breakpoint
CREATE TABLE "asistencia" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asistencia_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sesion_id" bigint NOT NULL,
	"alumno_id" bigint NOT NULL,
	"pago_id" bigint NOT NULL,
	"valor_clase" bigint NOT NULL,
	"porcentaje_bp" smallint NOT NULL,
	"registrado_por" bigint NOT NULL,
	"registrado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asistencia_sesion_alumno_uq" UNIQUE("sesion_id","alumno_id"),
	CONSTRAINT "asistencia_valor_no_negativo" CHECK ("asistencia"."valor_clase" >= 0),
	CONSTRAINT "asistencia_porcentaje_rango" CHECK ("asistencia"."porcentaje_bp" > 0 and "asistencia"."porcentaje_bp" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "clase" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clase_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"estilo" text NOT NULL,
	"nivel" text,
	"dia_semana" smallint NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fin" time NOT NULL,
	"profesor_id" bigint NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "clase_dia_valido" CHECK ("clase"."dia_semana" between 1 and 7),
	CONSTRAINT "clase_horario_valido" CHECK ("clase"."hora_fin" > "clase"."hora_inicio")
);
--> statement-breakpoint
CREATE TABLE "liquidacion" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "liquidacion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"profesor_id" bigint NOT NULL,
	"periodo" date NOT NULL,
	"monto" bigint NOT NULL,
	"pagado_en" timestamp with time zone,
	"registrado_por" bigint NOT NULL,
	CONSTRAINT "liquidacion_profesor_periodo_uq" UNIQUE("profesor_id","periodo"),
	CONSTRAINT "liquidacion_periodo_dia_uno" CHECK (extract(day from "liquidacion"."periodo") = 1),
	CONSTRAINT "liquidacion_monto_no_negativo" CHECK ("liquidacion"."monto" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pack" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pack_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"cantidad_clases" integer NOT NULL,
	"precio" bigint NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "pack_cantidad_positiva" CHECK ("pack"."cantidad_clases" > 0),
	CONSTRAINT "pack_precio_no_negativo" CHECK ("pack"."precio" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pago" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pago_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"alumno_id" bigint NOT NULL,
	"pack_id" bigint NOT NULL,
	"cantidad_clases" integer NOT NULL,
	"monto" bigint NOT NULL,
	"medio" "medio_pago" NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"vence_el" date NOT NULL,
	"registrado_por" bigint NOT NULL,
	"anulado_en" timestamp with time zone,
	"motivo_anulacion" text,
	CONSTRAINT "pago_cantidad_positiva" CHECK ("pago"."cantidad_clases" > 0),
	CONSTRAINT "pago_monto_no_negativo" CHECK ("pago"."monto" >= 0)
);
--> statement-breakpoint
CREATE TABLE "porcentaje_profesor" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "porcentaje_profesor_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"profesor_id" bigint NOT NULL,
	"porcentaje_bp" smallint NOT NULL,
	"vigente_desde" date NOT NULL,
	CONSTRAINT "porcentaje_profesor_vigencia_uq" UNIQUE("profesor_id","vigente_desde"),
	CONSTRAINT "porcentaje_bp_rango" CHECK ("porcentaje_profesor"."porcentaje_bp" > 0 and "porcentaje_profesor"."porcentaje_bp" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "profesor" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "profesor_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"apellido" text NOT NULL,
	"dni" text,
	"email" text,
	"telefono" text,
	"alias_cbu" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profesor_dni_unique" UNIQUE("dni")
);
--> statement-breakpoint
CREATE TABLE "sesion" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sesion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"clase_id" bigint NOT NULL,
	"fecha" date NOT NULL,
	"profesor_id" bigint NOT NULL,
	"estado" "estado_sesion" DEFAULT 'programada' NOT NULL,
	CONSTRAINT "sesion_clase_fecha_uq" UNIQUE("clase_id","fecha")
);
--> statement-breakpoint
CREATE TABLE "sesion_usuario" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" bigint NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "usuario_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "asistencia" ADD CONSTRAINT "asistencia_sesion_id_sesion_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencia" ADD CONSTRAINT "asistencia_alumno_id_alumno_id_fk" FOREIGN KEY ("alumno_id") REFERENCES "public"."alumno"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencia" ADD CONSTRAINT "asistencia_pago_id_pago_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pago"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencia" ADD CONSTRAINT "asistencia_registrado_por_usuario_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clase" ADD CONSTRAINT "clase_profesor_id_profesor_id_fk" FOREIGN KEY ("profesor_id") REFERENCES "public"."profesor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_profesor_id_profesor_id_fk" FOREIGN KEY ("profesor_id") REFERENCES "public"."profesor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_registrado_por_usuario_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_alumno_id_alumno_id_fk" FOREIGN KEY ("alumno_id") REFERENCES "public"."alumno"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_pack_id_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."pack"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_registrado_por_usuario_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "porcentaje_profesor" ADD CONSTRAINT "porcentaje_profesor_profesor_id_profesor_id_fk" FOREIGN KEY ("profesor_id") REFERENCES "public"."profesor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_clase_id_clase_id_fk" FOREIGN KEY ("clase_id") REFERENCES "public"."clase"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_profesor_id_profesor_id_fk" FOREIGN KEY ("profesor_id") REFERENCES "public"."profesor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesion_usuario" ADD CONSTRAINT "sesion_usuario_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alumno_busqueda_idx" ON "alumno" USING btree (lower("apellido"),lower("nombre"));--> statement-breakpoint
CREATE INDEX "asistencia_pago_idx" ON "asistencia" USING btree ("pago_id");--> statement-breakpoint
CREATE INDEX "pago_alumno_idx" ON "pago" USING btree ("alumno_id","vence_el");--> statement-breakpoint
CREATE INDEX "sesion_profesor_fecha_idx" ON "sesion" USING btree ("profesor_id","fecha");--> statement-breakpoint
CREATE INDEX "sesion_usuario_usuario_idx" ON "sesion_usuario" USING btree ("usuario_id");