export function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Email o contraseña incorrectos.";
  if (/user already registered|already been registered/i.test(message))
    return "Ya existe una cuenta con ese email.";
  if (/password should be at least/i.test(message))
    return "La contraseña debe tener al menos 8 caracteres.";
  if (/unable to validate email address|email address.*invalid/i.test(message))
    return "El email no parece válido.";
  if (/email rate limit|too many requests/i.test(message))
    return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
  if (/signups not allowed/i.test(message))
    return "El registro está deshabilitado. Contacta con el administrador.";
  return message;
}
