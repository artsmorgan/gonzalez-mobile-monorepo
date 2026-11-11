export function validateMobileVariableValue(
  variableType: string,
  rawValue: string,
): { valid: true; normalizedValue: string } | { valid: false; message: string } {
  const type = String(variableType ?? '').trim().toLowerCase();
  const value = String(rawValue ?? '').trim();

  if (value === '') {
    return { valid: false, message: 'El valor no puede estar vacío.' };
  }

  switch (type) {
    case 'int':
    case 'integer': {
      if (!/^-?\d+$/.test(value)) {
        return { valid: false, message: 'El valor debe ser un número entero.' };
      }
      const n = Number(value);
      if (!Number.isSafeInteger(n)) {
        return { valid: false, message: 'El valor entero está fuera de rango.' };
      }
      return { valid: true, normalizedValue: String(n) };
    }
    case 'float':
    case 'decimal':
    case 'double':
    case 'number': {
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        return { valid: false, message: 'El valor debe ser un número.' };
      }
      const n = Number(value);
      if (!Number.isFinite(n)) {
        return { valid: false, message: 'El valor debe ser un número válido.' };
      }
      return { valid: true, normalizedValue: String(n) };
    }
    case 'bool':
    case 'boolean': {
      const lower = value.toLowerCase();
      if (['true', '1', 'yes', 'si', 'sí'].includes(lower)) {
        return { valid: true, normalizedValue: 'true' };
      }
      if (['false', '0', 'no'].includes(lower)) {
        return { valid: true, normalizedValue: 'false' };
      }
      return {
        valid: false,
        message: 'El valor debe ser verdadero o falso (true/false, 1/0, sí/no).',
      };
    }
    case 'json': {
      try {
        const parsed = JSON.parse(value);
        return { valid: true, normalizedValue: JSON.stringify(parsed) };
      } catch {
        return { valid: false, message: 'El valor debe ser un JSON válido.' };
      }
    }
    case 'string':
    case 'text':
    default:
      return { valid: true, normalizedValue: value };
  }
}

export function getMobileVariableInputHint(variableType: string): string {
  const type = String(variableType ?? '').trim().toLowerCase();
  switch (type) {
    case 'int':
    case 'integer':
      return 'Número entero';
    case 'float':
    case 'decimal':
    case 'double':
    case 'number':
      return 'Número decimal';
    case 'bool':
    case 'boolean':
      return 'Verdadero o falso';
    case 'json':
      return 'JSON válido';
    default:
      return 'Texto';
  }
}

export function isBooleanVariableType(variableType: string): boolean {
  const type = String(variableType ?? '').trim().toLowerCase();
  return type === 'bool' || type === 'boolean';
}

export function isJsonVariableType(variableType: string): boolean {
  return String(variableType ?? '').trim().toLowerCase() === 'json';
}
