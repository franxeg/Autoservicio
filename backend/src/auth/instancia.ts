import { randomUUID } from 'crypto';

// Identificador unico de esta ejecucion del backend.
// Se incluye en los JWT emitidos: al reiniciar el servidor cambia el valor
// y las sesiones emitidas antes del reinicio dejan de ser validas, por lo que
// el usuario debe volver a iniciar sesion.
export const INSTANCIA_APP = randomUUID();
