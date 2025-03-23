# crt-filter for HTML Canvas

## Demo

http://code4fukui.github.io/crt-filter/

## Usage

```js
import { initFilterCRT } from "https://code4fukui.github.io/crt-filter/initFilterCRT.js";

const canvas = document.createElement("canvas");
initFilterCRT(canvas);
```

bgcolor
```js
initFilterCRT(canvas, [1.0, 0.0, 0.0]); // bgcolor = red
```

setActive
```js
const filteredcanvas = initFilterCRT(canvas);
chk.oninput = () => filteredcanvas.setActive(chk.checked);
```

## reference

- from [QUANTATTACK](https://qniapp.github.io/quantattack/) / [qniapp/quantattack](https://github.com/qniapp/quantattack/)
- [Based on PICO-8 CRT framework by ultrabrite (twitter: @SpaceTrucker2k0)](https://www.lexaloffle.com/bbs/?tid=33488)
- [Updated with CRT shader by Mattias Gustavsson (twitter: @Mattias_G)](https://github.com/mattiasgustavsson/crtview)
