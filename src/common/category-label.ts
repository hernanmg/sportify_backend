/** Etiqueta corta de categoría para API y plantel (M+35, M-Libre, F+30). */
export function shortCategoryLabel(name?: string | null): string {
  if (!name?.trim()) return '';
  const n = name.trim();
  const map: Record<string, string> = {
    Libre: 'M-Libre',
    'Masculino Libre': 'M-Libre',
    Masculino: '',
    '+35': 'M+35',
    'Masculino +35': 'M+35',
    '+40': 'M+40',
    'Masculino +40': 'M+40',
    '+45': 'M+45',
    'Masculino +45': 'M+45',
    Femenino: '',
    'Femenino +30': 'F+30',
    Juvenil: 'Juvenil',
  };
  if (map[n] !== undefined) return map[n];
  if (/^[MF][+\-]/.test(n) || n === 'Juvenil') return n;
  return n
    .replace(/^Masculino\s*/i, 'M')
    .replace(/^Femenino\s*/i, 'F')
    .replace(/\s+/g, '');
}
