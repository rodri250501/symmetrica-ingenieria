# Separación del catálogo público y las herramientas privadas

La aplicación ya está preparada para guardar dos piezas separadas:

- `programs/{id}` contiene solo el catálogo público: nombre, descripción, precio, icono, indicador de demo y `demoHtml`.
- `programContents/{id}` contiene el HTML completo de la herramienta y se consulta solo después de comprobar el acceso.

El catálogo público no debe contener un campo `html`. Quitar ese campo del objeto en Vue después de leerlo no lo protege: si el documento de Firestore todavía lo tiene, un visitante puede descargarlo desde la consulta de catálogo.

## Migración necesaria en Firebase

Haz una copia de seguridad de la colección `programs` antes de modificarla. Para cada programa que ya exista:

1. Copia su HTML completo a `programContents/{id}.html` y conserva `updatedAt`.
2. Deja en `programs/{id}` solo los campos públicos. Añade un `demoHtml` breve y seguro, o deja que la aplicación genere la vista previa segura.
3. Elimina físicamente `programs/{id}.html`; no basta con ocultarlo en la interfaz.
4. Publica las reglas de Firestore y comprueba el acceso anónimo, el acceso a una herramienta comprada, la suscripción anual y la licencia perpetua.

El formulario de administración actual escribe el contenido nuevo en `programContents` y elimina el campo público `html` cuando actualiza un programa. Las herramientas antiguas necesitan la migración anterior una sola vez.

La función `buildSafeDemoHtml` crea una vista informativa sin el motor de cálculo. El mecanismo antiguo que bloqueaba inputs en una copia del HTML no debe usarse como protección: aunque bloquee la interacción, todavía expone el código fuente al navegador.

## Borrador de reglas

Integra este bloque en las reglas actuales del proyecto. No lo publiques sin revisar primero las reglas existentes para `users`, compras, solicitudes y administración. La función `admin()` supone que el rol de administrador se guarda en `users/{uid}.role`.

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function admin() {
      return signedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function ownsProgram(programId) {
      let account = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
      return (account.purchasedTools is list && account.purchasedTools.hasAny([programId])) ||
        (account.subscription is map &&
          account.subscription.status == 'active' &&
          (account.subscription.type == 'lifetime' ||
            (account.subscription.type == 'annual' &&
              account.subscription.expiresAt > request.time)));
    }

    match /programs/{programId} {
      allow read: if admin() ||
        resource.data.keys().hasOnly([
          'name', 'description', 'price', 'icon', 'demo', 'demoHtml', 'createdAt'
        ]);
      allow write: if admin();
    }

    match /programContents/{programId} {
      allow read: if admin() ||
        get(/databases/$(database)/documents/programs/$(programId)).data.price == 0 ||
        (signedIn() && ownsProgram(programId));
      allow write: if admin();
    }
  }
}
```

Las reglas deben probarse con el emulador o con la herramienta de Rules de Firebase antes de producción. Una consulta de catálogo solo funcionará para visitantes cuando todos los documentos públicos cumplan el esquema sin `html`.

## Límite real de protección

Esta separación impide que un visitante o usuario no autorizado reciba el HTML completo de una herramienta de pago. No puede impedir que una persona autorizada copie el código que su propio navegador recibió: DevTools, la red y el almacenamiento local permiten inspeccionarlo. Para ocultar también el algoritmo frente a clientes autorizados habría que ejecutar el cálculo en un backend y enviar únicamente entradas y resultados (o aceptar que un módulo descargado al navegador puede ser extraído).
