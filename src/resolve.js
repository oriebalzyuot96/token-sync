// Flattens a W3C-style token tree and resolves "{dotted.path}" references.
//
// Output shape:
//   {
//     tokens: { "color.brand": { path, type, value }, ... },   // light mode, fully resolved
//     dark:   { "color.brand": value, ... }                    // only tokens with a dark override
//   }

const WHOLE_REF = /^\{([^{}\s]+)\}$/;
const EMBEDDED_REF = /\{([^{}\s]+)\}/g;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Collects every leaf token (an object with "$value") keyed by dotted path.
// "$type" is inherited from the nearest group that declares it.
export function flatten(tree) {
  if (!isPlainObject(tree)) {
    throw new TypeError("Token source must be a JSON object");
  }
  const tokens = new Map();

  const walk = (node, path, inheritedType) => {
    const type = node.$type ?? inheritedType;
    if ("$value" in node) {
      if (path.length === 0) {
        throw new Error("The root object cannot be a token; wrap tokens in groups");
      }
      const dotted = path.join(".");
      tokens.set(dotted, {
        path: dotted,
        type,
        value: node.$value,
        dark: node.$extensions?.modes?.dark,
      });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$")) continue;
      const childPath = [...path, key];
      if (!isPlainObject(child)) {
        throw new Error(`Invalid token "${childPath.join(".")}": expected an object`);
      }
      walk(child, childPath, type);
    }
  };

  walk(tree, [], undefined);
  return tokens;
}

// Turns a resolved value into plain text (CSS/SCSS/JS friendly).
// Supports strings, numbers, arrays (font stacks) and {value, unit} dimensions.
export function valueToText(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (/\s/.test(String(item)) ? `"${item}"` : String(item)))
      .join(", ");
  }
  if (isPlainObject(value) && "value" in value && "unit" in value) {
    return `${value.value}${value.unit}`;
  }
  if (isPlainObject(value)) {
    throw new TypeError(`Unsupported composite token value: ${JSON.stringify(value)}`);
  }
  return String(value);
}

export function resolve(tree) {
  const tokens = flatten(tree);
  const cache = new Map();

  // Resolves the token at `path` in the given mode ("light" or "dark").
  // `chain` holds the paths currently being resolved, used for cycle detection
  // and for error messages.
  const resolveToken = (path, mode, chain) => {
    const token = tokens.get(path);
    if (!token) {
      const from = chain[chain.length - 1];
      const where = from ? ` in token "${from}"` : "";
      throw new Error(`Missing reference "{${path}}"${where}: no token has the path "${path}"`);
    }
    if (chain.includes(path)) {
      const loop = [...chain.slice(chain.indexOf(path)), path];
      throw new Error(`Circular reference: ${loop.join(" -> ")}`);
    }

    const key = `${mode}\u0000${path}`;
    if (cache.has(key)) return cache.get(key);

    const raw = mode === "dark" && token.dark !== undefined ? token.dark : token.value;
    const value = resolveNode(raw, mode, [...chain, path]);
    cache.set(key, value);
    return value;
  };

  const resolveNode = (node, mode, chain) => {
    if (typeof node === "string") {
      const whole = WHOLE_REF.exec(node);
      if (whole) {
        return resolveToken(whole[1], mode, chain);
      }
      return node.replace(EMBEDDED_REF, (_, ref) =>
        valueToText(resolveToken(ref, mode, chain)),
      );
    }
    if (Array.isArray(node)) {
      return node.map((item) => resolveNode(item, mode, chain));
    }
    if (isPlainObject(node)) {
      return Object.fromEntries(
        Object.entries(node).map(([k, v]) => [k, resolveNode(v, mode, chain)]),
      );
    }
    return node;
  };

  const result = { tokens: {}, dark: {} };
  for (const [path, token] of tokens) {
    result.tokens[path] = {
      path,
      type: token.type,
      value: resolveToken(path, "light", []),
    };
    if (token.dark !== undefined) {
      result.dark[path] = resolveToken(path, "dark", []);
    }
  }
  return result;
}
