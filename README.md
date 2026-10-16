# token-sync

One design-token JSON file in, three theme outputs out:

- `tokens.css`: `:root` and `[data-theme=dark]` CSS custom properties
- `tailwind.tokens.js`: a Tailwind theme object that points at those CSS variables
- `_theme.scss`: Angular/SCSS variables plus a token map and a dark-override map

No dependencies. Requires Node 24 or newer.

## Usage

```sh
node src/cli.js examples/tokens.json --out dist/tokens
# or, after npm link / npm install -g:
token-sync examples/tokens.json --out dist/tokens
```

Run the tests with `npm test`.

## Source format

The source uses the W3C design tokens style. Groups can carry `$type`, which children inherit. Leaves carry `$value`.

```json
{
  "color": {
    "$type": "color",
    "brand": { "$value": "#1784bd" },
    "text": {
      "$value": "{color.neutral.900}",
      "$extensions": { "modes": { "dark": "{color.neutral.50}" } }
    }
  }
}
```

- **References**: `"{dotted.path}"` resolves to another token's value. Chains (`a -> b -> c`) work. A reference embedded in a larger string, such as `"0 0 0 2px {color.brand}"`, is substituted as text.
- **Dark mode**: put the dark value in `$extensions.modes.dark`. Its references resolve in dark mode. Tokens without a dark value keep their light value in both modes.
- **Values**: strings, numbers, arrays (font stacks, which are joined with commas and quoted when a name has spaces), and `{ "value": 120, "unit": "ms" }` dimensions.
- **Top-level groups**: `color`, `space`, `radius`, `font` and `motion` map to Tailwind's `colors`, `spacing`, `borderRadius`, `fontFamily` and `transitionDuration`. Other top-level groups keep their own name in the Tailwind theme.

`examples/tokens.json` shows every case.

## Outputs

Each token path becomes a name by joining its segments with `-`. For example, `color.neutral.900` becomes `--color-neutral-900` in CSS and `$color-neutral-900` in SCSS.

`tokens.css`:

```css
:root {
  --color-brand: #1784bd;
  --font-arabic: "Noto Sans Arabic", Tahoma, sans-serif;
}
[data-theme=dark] {
  --color-brand: #5cb8e8;
}
```

`tailwind.tokens.js` exports `theme` (also the default export). Values are `var(--…)` references, so the theme follows the active `[data-theme]`. Include `tokens.css` on the page:

```js
// tailwind.config.js
import { theme } from "./dist/tokens/tailwind.tokens.js";
export default { theme: { extend: theme } };
```

`_theme.scss` contains one `$variable` per token, a `$tokens` map of light values and a `$tokens-dark` map of dark overrides. Import it into your Angular styles, or read the maps from a theme function.

## Limits

- **No Figma API calls.** You export the variables JSON yourself, then feed that file in. The tool never talks to Figma.
- **Only the source file is read.** Nothing is fetched, and no other project files are touched.
- **Modes**: only light and dark, via `$extensions.modes.dark`. Other modes are ignored.
- **Composite types**: only `{value, unit}` dimensions and arrays are formatted. Other object values (such as W3C typography or shadow objects) throw an error.
- **Tailwind**: because the values are CSS variables, Tailwind opacity modifiers such as `bg-brand/50` do not work on these colors.
- **SCSS** receives the light values as literals. Dark mode is available only through `$tokens-dark` or the CSS output.
- **Unknown groups** are not validated. Token names are not checked against any naming scheme.
