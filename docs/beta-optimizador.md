# Symmetrica: primera corrección para la beta

12 de septiembre de 2026. Rama local: `codex/optimizador-beta`.

**Estado: cambios preparados y probados localmente. No se han subido a GitHub, desplegado en Vercel ni escrito en Firebase.** Esto corrige errores de software; no certifica el diseño estructural ni deja resuelto el cobro por suscripción.

## Cambios

| Antes | Ahora, en esta copia |
| --- | --- |
| El botón principal pedía iniciar sesión. | «Explorar herramientas» lleva al catálogo. |
| La calculadora con precio 0 aparecía bloqueada. | «Gratis» y «Usar gratis», con campos editables sin cuenta. |
| La actualización de autenticación podía cerrar una demo. | Se conservan demos y herramientas gratuitas; las vistas privadas siguen requiriendo usuario. |
| Las opciones mostraban 280 y 4200 junto a etiquetas MPa, pero enviaban 28 y 420. | Las etiquetas coinciden con los valores usados. |
| Con As requerida de aproximadamente 5,91 cm² se ofrecía 5φ12 = 5,655 cm². | Se descarta todo armado por debajo de la demanda. Se conserva 3φ16 = 6,033 cm². |
| El número de barras era `[object Object]`. | Es un entero calculado a partir de las cantidades. |
| Entradas inválidas podían dejar resultados anteriores o un estado de éxito. | Se muestra el error y se ocultan resultados anteriores. Los barridos excesivos o que no pueden avanzar se rechazan. |
| Costos cero producían porcentajes NaN. | La comparación y los gráficos admiten ese caso sin dividir por cero. |

Se aclara que los costos de las secciones usan As teórica y que la tabla de barras usa áreas comerciales. La búsqueda devuelve hasta diez alternativas y tiene un presupuesto de 25.000 visitas; ordena las alternativas encontradas y no garantiza el armado óptimo global. Acumula las áreas tabuladas como enteros de 0,001 cm² y redondea la demanda hacia arriba. Las propuestas todavía requieren verificación de disposición física.

## Dónde está el código

- `index.html`, `src/app.js`, `src/composables/usePrograms.js`: navegación y acceso a la herramienta gratuita.
- `src/core/program-access.mjs`: decisiones de acceso de la interfaz.
- `programs/optimizador-vigas.html`: copia corregida del optimizador, lista para revisión e importación manual posterior.
- `programs/optimizador-vigas.origin.json`: documento de origen, fecha de actualización y SHA-256 del HTML original.
- `tests/`: pruebas sin dependencias adicionales.

La web sigue leyendo `programs/{id}.html` desde Firebase. **Subir estos archivos a GitHub no actualiza automáticamente la calculadora almacenada en Firebase.**

Se añade `.vercelignore` para excluir `programs/`, `tests/` y `docs/` del despliegue estático. Así se prepara la fuente para su revisión sin añadir deliberadamente una URL pública independiente del optimizador en Vercel. Debe comprobarse en el despliegue de prueba; no se ejecutó un despliegue remoto. Esto no protege el repositorio público ni corrige el acceso actual de Firestore. [Documentación de Vercel](https://vercel.com/docs/deployments/vercel-ignore).

## Verificación

22 pruebas automatizadas aprobadas: 16 del optimizador y 6 de acceso. Incluyen demandas justo por encima de un armado, todos los diámetros disponibles, coherencia de áreas y cantidades, costos cero, campos inválidos, rangos extremos y limpieza de resultados. Se ejecuta el script real contenido en el HTML; los tests no mantienen una segunda implementación del motor.

```sh
node --test --test-isolation=none tests/program-access.test.mjs tests/optimizer.test.mjs
```

En el navegador local se comprobó: explorar sin registro, abrir y recalcular la herramienta gratuita, abrir la demo del catálogo, calcular el optimizador corregido y rechazar un cálculo sin diámetros. El caso inicial conserva b = 20 cm, h = 30 cm, d = 25 cm, As = 5,9066941598 cm² y costo teórico = 130,9128471881 USD. Conservar esos valores verifica la regresión del software; no acredita su validez normativa.

## Antes de la beta comercial

1. **Validar el modelo estructural.** Revisar con casos manuales documentados las fórmulas, unidades y límites, el tratamiento de acero mínimo, la definición de peralte efectivo, ductilidad, cortante, servicio y disposición de barras. Las ecuaciones de `calcularAcero` permanecen iguales a la fuente recibida. La métrica llamada «robustez» todavía requiere una interpretación técnica justificada.
2. **Corregir la entrega del contenido de pago.** `loadPrograms()` descarga documentos completos que incluyen el HTML. Bloquear campos en la demo es una restricción de interfaz. Separar metadatos y demo públicos del contenido autorizado, y revisar las reglas reales de Firestore o un backend antes de integrar pagos. El repositorio no incluye esas reglas; no se comprobó una escalada de privilegios.
3. **Revisar aislamiento y aprobación de pagos.** Los iframes usan scripts y el mismo origen del padre. Probar aislamiento sin `allow-same-origin` o mediante otro origen. La aprobación actual hace dos escrituras separadas; debería conceder acceso y aprobar la solicitud de forma atómica.

## Aplicación posterior de los cambios

El paquete incluye una copia del proyecto sin `.git` y un parche para el commit de origen indicado en el manifiesto. Para revisar sobre un clon de ese commit, aplicar el parche en una rama de trabajo y ejecutar las pruebas. No es necesario cambiar los precios ni migrar la base de datos para revisar estas correcciones.

Para probar la fuente del optimizador localmente, servir la carpeta del proyecto y abrir `/programs/optimizador-vigas.html`. Los gráficos requieren conexión a sus CDN. La web principal consulta el catálogo actual de Firebase; su demo todavía muestra el HTML remoto hasta completar la importación.

Después de la revisión técnica, actualizar en el panel de administración **solo el HTML de «OPTIMIZADOR DE VIGAS»**, documento `j80SMLmTz3hN6xsEjUuD`, con el contenido de `programs/optimizador-vigas.html`. Antes de hacerlo, guardar una copia del HTML vigente y comprobar si fue actualizado después del respaldo. Probar después tanto la demo como el programa completo. Esta operación sobre Firebase no se ha realizado.

La reversión del frontend y la del HTML de Firebase son independientes. El paquete conserva el HTML original descargado como respaldo de referencia; no sustituye una copia fresca si hubo modificaciones posteriores.
