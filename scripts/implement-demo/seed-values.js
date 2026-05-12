// Pure functions to generate plausible mock values for the seed arrays
// produced by `implement_demo_for_framework`. No `faker` dependency — the
// goal is "looks real enough for a demo", not data-science-grade realism.

const FIRST_NAMES = ['Ana', 'Roberto', 'Lucía', 'Diego', 'Camila', 'Martín', 'Sofía', 'Tomás', 'Valentina', 'Joaquín'];
const LAST_NAMES = ['Lema', 'Suárez', 'Pérez', 'González', 'Romero', 'Acosta', 'Fernández', 'Torres', 'Castro', 'Rojas'];
const COMPANIES = [
  'Logística del Sur S.A.', 'Constructora Andina SRL', 'Inmobiliaria Tres Ríos',
  'Frigorífico Pampa SA', 'Distribuidora Pacífico', 'Industrial del Norte',
  'Servicios Globales SA', 'Comercial Atlántico', 'Editorial del Plata',
  'Naviera Patagónica',
];

let seededIndex = 0;
function pick(arr, i = seededIndex++) {
  return arr[i % arr.length];
}

function pad(n, width = 5) {
  return String(n).padStart(width, '0');
}

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${pad(d.getDate(), 2)}/${pad(d.getMonth() + 1, 2)}/${d.getFullYear()}`;
}

function valueForField(field, entityName, idx) {
  const { name, type, options } = field;
  const lower = name.toLowerCase();

  if (type === 'enum' && Array.isArray(options) && options.length > 0) {
    return options[idx % options.length];
  }
  if (type === 'boolean') return idx % 2 === 0;
  if (type === 'date') return todayPlus(-idx * 3);
  if (type === 'number') {
    if (lower.includes('monto') || lower.includes('amount') || lower.includes('total')) {
      return Math.round((1000 + idx * 1234.56) * 100) / 100;
    }
    return idx + 1;
  }
  if (type === 'array') return [];
  if (type === 'object') return {};

  // string fallbacks based on field-name heuristics
  if (lower === 'id') return `${entityName.slice(0, 3).toUpperCase()}-${pad(idx + 1)}`;
  if (lower.includes('cliente') || lower.includes('company')) return pick(COMPANIES, idx);
  if (lower.includes('cuit') || lower.includes('tax')) {
    return `30-${pad(70_000_000 + idx * 1117, 8)}-${(idx % 9) + 1}`;
  }
  if (lower === 'nombre' || lower === 'name' || lower.includes('user')) {
    return `${pick(FIRST_NAMES, idx)} ${pick(LAST_NAMES, idx + 3)}`;
  }
  if (lower.includes('email')) {
    return `${pick(FIRST_NAMES, idx).toLowerCase()}.${pick(LAST_NAMES, idx + 3).toLowerCase()}@example.com`;
  }
  if (lower.includes('estado') || lower.includes('status')) {
    return ['Pendiente', 'En curso', 'Completada'][idx % 3];
  }
  if (lower.includes('prioridad') || lower.includes('priority')) {
    return ['Alta', 'Media', 'Baja'][idx % 3];
  }
  if (lower.includes('descripcion') || lower.includes('description') || lower.includes('detalle')) {
    return `Registro ${entityName} #${idx + 1} — detalle de muestra.`;
  }
  return `${entityName} ${idx + 1}`;
}

export function generateSeed(entity, count = entity.seedCount || 5) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const row = {};
    for (const field of entity.fields) {
      row[field.name] = valueForField(field, entity.name, i);
    }
    out.push(row);
  }
  return out;
}
