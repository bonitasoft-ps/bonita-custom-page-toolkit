// Spec validator for `implement_demo_for_framework`.
// Rejects malformed input early with a clear, parseable error message
// (so an MCP caller can pinpoint what to fix without trial and error).

const FIELD_TYPES = new Set(['string', 'number', 'boolean', 'date', 'enum', 'object', 'array']);
const PAGE_KINDS = new Set(['list-detail', 'dashboard', 'form-wizard']);
const PALETTE_KEYS = new Set(['primary', 'secondary', 'accent']);

export function validateSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') {
    return { ok: false, errors: ['spec must be an object'] };
  }
  if (!spec.domain || typeof spec.domain !== 'string') {
    errors.push('spec.domain is required (short string label)');
  }
  if (!Array.isArray(spec.entities) || spec.entities.length === 0) {
    errors.push('spec.entities must be a non-empty array');
  } else {
    const names = new Set();
    spec.entities.forEach((e, idx) => {
      const path = `spec.entities[${idx}]`;
      if (!e.name) errors.push(`${path}.name is required`);
      if (names.has(e.name)) errors.push(`${path}.name "${e.name}" is duplicated`);
      names.add(e.name);
      if (!Array.isArray(e.fields) || e.fields.length === 0) {
        errors.push(`${path}.fields must be a non-empty array`);
      } else {
        e.fields.forEach((f, fIdx) => {
          const fpath = `${path}.fields[${fIdx}]`;
          if (!f.name) errors.push(`${fpath}.name is required`);
          if (!f.type) errors.push(`${fpath}.type is required`);
          if (f.type && !FIELD_TYPES.has(f.type)) {
            errors.push(`${fpath}.type "${f.type}" is not one of ${[...FIELD_TYPES].join(', ')}`);
          }
          if (f.type === 'enum' && (!Array.isArray(f.options) || f.options.length === 0)) {
            errors.push(`${fpath} is enum but has no options`);
          }
        });
      }
    });
    // Second pass: validate refs
    spec.entities.forEach((e, idx) => {
      (e.fields || []).forEach((f, fIdx) => {
        if (f.ref && !names.has(f.ref)) {
          errors.push(`spec.entities[${idx}].fields[${fIdx}].ref "${f.ref}" does not match any entity name`);
        }
      });
    });
  }
  if (!Array.isArray(spec.pages) || spec.pages.length === 0) {
    errors.push('spec.pages must be a non-empty array');
  } else {
    const paths = new Set();
    spec.pages.forEach((p, idx) => {
      const ppath = `spec.pages[${idx}]`;
      if (!p.name) errors.push(`${ppath}.name is required`);
      if (!p.path) errors.push(`${ppath}.path is required`);
      else if (!p.path.startsWith('/')) {
        errors.push(`${ppath}.path "${p.path}" must start with '/' (hash routing)`);
      } else if (paths.has(p.path)) {
        errors.push(`${ppath}.path "${p.path}" is duplicated across pages`);
      }
      paths.add(p.path);
      if (!p.kind || !PAGE_KINDS.has(p.kind)) {
        errors.push(`${ppath}.kind must be one of ${[...PAGE_KINDS].join(', ')}`);
      }
      if (p.kind === 'list-detail' && !p.primaryEntity) {
        errors.push(`${ppath} is list-detail but missing primaryEntity`);
      }
    });
  }
  if (spec.palette) {
    if (typeof spec.palette !== 'object') {
      errors.push('spec.palette must be an object');
    } else {
      for (const key of Object.keys(spec.palette)) {
        if (!PALETTE_KEYS.has(key)) {
          errors.push(`spec.palette has unknown key "${key}". Allowed: ${[...PALETTE_KEYS].join(', ')}`);
        }
        const val = spec.palette[key];
        if (val && !/^#[0-9a-fA-F]{3,8}$/.test(val)) {
          errors.push(`spec.palette.${key} "${val}" is not a valid hex color`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
