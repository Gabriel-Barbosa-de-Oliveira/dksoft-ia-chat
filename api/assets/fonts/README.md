# Fontes embarcadas

Archivo Regular (400) e SemiBold (600), subconjunto latino (cobre o português do Brasil), licença SIL OFL 1.1 (`OFL.txt`).

Origem: pacote npm `@fontsource/archivo@5.3.0` (arquivos `archivo-latin-400-normal.woff` e `archivo-latin-600-normal.woff`).
Conversão para TTF (pdfmake e resvg não leem WOFF), sem alterar glifos:

```python
from fontTools.ttLib import TTFont
f = TTFont("archivo-latin-400-normal.woff"); f.flavor = None; f.save("Archivo-Regular.ttf")
```

A imagem Docker não tem fontes de sistema; estes arquivos são a única fonte do PDF e dos gráficos em PNG.
