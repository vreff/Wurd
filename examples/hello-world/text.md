---
dropCap: true
accentColor: '#4a9eff'
---

# Hello World

This is a minimal example of a compiled document. It uses only **deterministic plugins** — no LLM API key needed.

## Math

The quadratic formula is [plugin:math]x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}[/plugin], one of the most well-known equations in algebra.

A block equation:

[plugin:math]
\[E = mc^2\]
[/plugin]

## Accordion

[plugin:accordion]
What is this tool? | A document compiler that turns markdown with plugin tags into editorial-quality HTML pages.
How does it work? | Write markdown, add plugin tags for math, graphs, tables, and more. Run the compiler and get a self-contained HTML page.
Do I need an API key? | Only for AI-driven plugins like graphs and tables. Math, accordions, and citations work without one.
[/plugin]

## Citations

The web was invented by Tim Berners-Lee[plugin:cite]Berners-Lee, "Information Management: A Proposal", 1989, https://www.w3.org/History/1989/proposal.html[/plugin] at CERN. Markdown was created by John Gruber[plugin:cite]Gruber, "Markdown", 2004, https://daringfireball.net/projects/markdown/[/plugin].

That's it! Open the output HTML file in your browser to see the result.
