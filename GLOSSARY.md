# Studio Manager

Sistema de gestión de un estudio de danza. Lo usa el personal del estudio para cobrar packs, tomar asistencia y calcular lo que se le paga a cada profesor. Los alumnos no entran al sistema.

## Language

### Personas

**Alumno**:
Persona que toma clases en el estudio. Se da de baja o de alta, nunca se borra.
_Avoid_: Cliente, estudiante

**Profesor**:
Persona que dicta clases y cobra un porcentaje del valor de cada clase a la que asistió un alumno.
_Avoid_: Docente, instructor

**Personal**:
Administradores y recepción, las únicas personas que usan el sistema.
_Avoid_: Usuario (salvo para la cuenta de login)

**Baja automática**:
Baja que hace el sistema cuando un alumno pasa 2 meses sin comprar un pack.
_Avoid_: Baja por inactividad

### Clases

**Horario**:
Clase que se repite cada semana, por ejemplo "Hip-Hop, martes 19:00", con un profesor titular.
_Avoid_: Turno, cronograma

**Clase**:
Un horario dictado en una fecha concreta, con el profesor que la dio de verdad. Una clase única no sale de ningún horario.
_Avoid_: Sesión, turno

**Titular**:
Profesor asignado a un horario.
_Avoid_: Profesor base

**Suplencia**:
Clase dada por un profesor distinto del titular.
_Avoid_: Reemplazo

**Cambios propios**:
Diferencias de una clase respecto de su horario (día, horas, estilo, nivel, profesor o estado). Una clase con cambios propios deja de seguir a su horario cuando el horario cambia.
_Avoid_: Excepción, modificación

**Horizonte**:
Semanas hacia adelante para las que ya existen las clases de cada horario.
_Avoid_: Ventana, rango de generación

**Sesión**:
Solo la de login de una persona del personal. Nunca se usa para una clase.

### Packs y pagos

**Pack**:
Producto que se vende: un número fijo de clases, válidas para cualquier clase del estudio.
_Avoid_: Paquete, plan, abono

**Clase suelta**:
Pack de 1 clase.
_Avoid_: Clase individual

**Pago**:
Compra de un pack por un alumno. Guarda lo que se cobró y la cantidad de clases de ese día.
_Avoid_: Compra, venta, cobro

**Vencimiento**:
Fecha hasta la que se pueden usar las clases de un pago. Es un mes después de la compra y el administrador puede extenderla. Las clases no usadas se pierden.
_Avoid_: Caducidad

**Clases restantes**:
Clases de un pago menos las asistencias registradas contra ese pago.
_Avoid_: Saldo, crédito

**Anulación**:
Forma de dejar sin efecto un pago mal cargado. Solo se puede si el pago no tiene asistencias.
_Avoid_: Borrado, cancelación de pago

### Asistencia y sueldo

**Asistencia**:
Registro de que un alumno fue a una clase y usó una clase de un pago.
_Avoid_: Presente, anotación

**Valor de clase**:
Monto del pago dividido la cantidad de clases del pago, redondeado. Se fija al registrar la asistencia.
_Avoid_: Precio de clase

**Porcentaje del profesor**:
Parte del valor de clase que cobra el profesor. Tiene historial, y cada asistencia conserva el vigente al registrarla.
_Avoid_: Comisión

**Sueldo**:
Suma de lo que corresponde a un profesor por las asistencias a sus clases en un mes.
_Avoid_: Honorarios, salario

**Liquidación**:
Monto fijo que se le pagó a un profesor por un mes. No cambia aunque después se corrija una asistencia.
_Avoid_: Recibo

### Dinero y fechas

**Pesos enteros**:
Todo el dinero se expresa en pesos sin centavos.

**Puntos básicos**:
Unidad de los porcentajes: 10000 es el 100% y 5000 es el 50%.
_Avoid_: Porcentaje decimal

**Día**:
Fecha del negocio sin hora, en la zona de Buenos Aires.
_Avoid_: Timestamp, fecha y hora
