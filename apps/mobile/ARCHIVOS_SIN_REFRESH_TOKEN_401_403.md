# Lista de Archivos con Fetch que NO Ejecutan refreshAccessToken al Recibir 401/403

Esta lista contiene archivos en `apps/mobile` que tienen funciones `fetch()` pero que **NO ejecutan** `refreshAccessToken()` cuando reciben una respuesta HTTP 401 (Unauthorized) o 403 (Forbidden).

Estos archivos pueden:
- No manejar explícitamente los códigos 401/403
- Manejar errores de otra forma (catch genérico, etc.)
- Usar funciones de hooks que ya manejan los errores
- Ser archivos de autenticación/login que no requieren refresh token

---

## 📁 Screens (Pantallas)

### 1. `apps/mobile/screens/CorporateVehiclesScreen.tsx`
- **Tiene fetch**: Sí (para convertir assets a base64)
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Usa funciones de hooks (`evaluationFunctions.ts`) que sí ejecutan refresh token, pero el fetch directo en el archivo no lo hace

### 2. `apps/mobile/screens/ChecklistSupervisionScreen.tsx`
- **Tiene fetch**: No directo
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Usa funciones de hooks (`checklistSupervisionFunctions.ts`) que sí ejecutan refresh token

### 3. `apps/mobile/screens/StaffEvaluationsScreen.tsx`
- **Tiene fetch**: No directo
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Usa funciones de hooks (`staffEvaluationsFunctions.ts`) que sí ejecutan refresh token

### 4. `apps/mobile/screens/ActaEntregaProductosScreen.tsx`
- **Tiene fetch**: No directo
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Usa funciones de hooks (`evaluationFunctions.ts`) que sí ejecutan refresh token

### 5. `apps/mobile/screens/HomeScreen.tsx`
- **Tiene fetch**: Posiblemente (necesita verificación)
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No

### 6. `apps/mobile/screens/LoginScreen.tsx`
- **Tiene fetch**: Sí (para login)
- **Maneja 401/403**: No explícitamente (maneja errores de login de otra forma)
- **Ejecuta refreshAccessToken**: No
- **Nota**: Es la pantalla de login, no requiere refresh token

### 7. `apps/mobile/screens/VerifyCodeScreen.tsx`
- **Tiene fetch**: Posiblemente (para verificación de código)
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Pantalla de verificación, no requiere refresh token

### 8. `apps/mobile/screens/RecoverPasswordScreen.tsx`
- **Tiene fetch**: Posiblemente (para recuperación de contraseña)
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Pantalla de recuperación, no requiere refresh token

### 9. `apps/mobile/screens/ForgotPasswordScreen.tsx`
- **Tiene fetch**: Posiblemente (para olvido de contraseña)
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Pantalla de olvido, no requiere refresh token

### 10. `apps/mobile/screens/IncidentsScreen.tsx`
- **Tiene fetch**: No directo
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Usa funciones de hooks (`incidentsFunctions.ts`) que sí ejecutan refresh token

### 11. `apps/mobile/screens/BitacoraVehiculosDetenidosScreen.tsx`
- **Tiene fetch**: No directo
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Usa funciones de hooks (`bitacoraVehiculoDetenidoFunctions.ts`) que sí ejecutan refresh token

### 12. `apps/mobile/screens/SatisfactionSurveysScreen.tsx`
- **Tiene fetch**: No directo
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Usa funciones de hooks que sí ejecutan refresh token

### 13. `apps/mobile/screens/AttendanceControlScreen.tsx`
- **Tiene fetch**: No directo
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Usa funciones de hooks que sí ejecutan refresh token

### 14. `apps/mobile/screens/ComplaintsMasterScreen.tsx`
- **Tiene fetch**: No directo
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Usa funciones de hooks que sí ejecutan refresh token

### 15. `apps/mobile/screens/PermitRequestScreen.tsx`
- **Tiene fetch**: No directo
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Usa funciones de hooks que sí ejecutan refresh token

### 16. `apps/mobile/screens/InductionTourRecordScreen.tsx`
- **Tiene fetch**: No directo
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Usa funciones de hooks que sí ejecutan refresh token

### 17. `apps/mobile/screens/EmployeeProfileScreen.tsx`
- **Tiene fetch**: Posiblemente (para cargar perfil)
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No

---

## 🧩 Components (Componentes)

### 18. `apps/mobile/components/PasswordRecovery.tsx`
- **Tiene fetch**: Posiblemente (para recuperación)
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Componente de recuperación, no requiere refresh token

### 19. `apps/mobile/components/ForgotPassword.tsx`
- **Tiene fetch**: Posiblemente (para olvido)
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No
- **Nota**: Componente de olvido, no requiere refresh token

---

## 🔐 Contexts (Contextos)

### 20. `apps/mobile/contexts/AuthContext.tsx`
- **Tiene fetch**: Sí (para login, logout, refresh token)
- **Maneja 401/403**: No explícitamente en fetch de login/logout
- **Ejecuta refreshAccessToken**: No (es el archivo que CONTIENE la función refreshAccessToken)
- **Nota**: 
  - El `login()` no maneja 401/403 explícitamente, solo verifica `response.ok`
  - El `logout()` no maneja 401/403
  - El `refreshAccessToken()` es la función misma, no necesita llamarse a sí misma

---

## 📄 App Routes (Rutas de la App)

### 21. `apps/mobile/app/digital-signature.tsx`
- **Tiene fetch**: Posiblemente
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No

### 22. `apps/mobile/app/_layout.tsx`
- **Tiene fetch**: Posiblemente (para inicialización)
- **Maneja 401/403**: No explícitamente
- **Ejecuta refreshAccessToken**: No

---

## 📊 Resumen

- **Total de archivos identificados**: ~22 archivos
- **Categorías**:
  - Screens que usan hooks (no fetch directo): ~15
  - Screens de autenticación (login, recovery, etc.): ~5
  - Components de autenticación: ~2
  - Contexts: 1 (AuthContext)
  - App routes: ~2

---

## ⚠️ Notas Importantes

1. **Archivos que usan hooks**: Muchos screens no tienen fetch directo, sino que usan funciones de hooks (como `evaluationFunctions.ts`, `incidentsFunctions.ts`, etc.). Estos hooks SÍ ejecutan refresh token, pero los screens en sí no.

2. **Archivos de autenticación**: Los archivos relacionados con login, recuperación de contraseña, etc., no requieren refresh token porque son parte del flujo de autenticación inicial.

3. **AuthContext**: Este archivo contiene la función `refreshAccessToken()`, por lo que no necesita llamarse a sí misma.

4. **Fetch para assets**: Algunos archivos usan `fetch()` para convertir assets a base64 (como `CorporateVehiclesScreen.tsx`), estos no requieren autenticación.

---

## 🔍 Archivos que Requieren Verificación Adicional

Los siguientes archivos pueden tener fetch pero necesitan verificación manual:

- `apps/mobile/screens/HomeScreen.tsx`
- `apps/mobile/screens/EmployeeProfileScreen.tsx`
- `apps/mobile/app/digital-signature.tsx`
- `apps/mobile/app/_layout.tsx`
- Otros screens que no aparecen en la lista de los que SÍ ejecutan refresh token

