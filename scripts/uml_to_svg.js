const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const crypto = require('crypto');

const BUNDLE_PATH = path.join(__dirname, '../js/uml-bundle.js');
const CACHE_DIR = path.join(__dirname, '../.uml_cache');

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

async function renderUML(type, text) {
    const hash = crypto.createHash('md5').update(type + text).digest('hex');
    const cachePath = path.join(CACHE_DIR, hash + '.svg');

    if (fs.existsSync(cachePath)) {
        return fs.readFileSync(cachePath, 'utf8');
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Create a minimal HTML with the bundle
    const bundleJs = fs.readFileSync(BUNDLE_PATH, 'utf8');
    const html = `
        <html>
        <head>
            <style>
                .uml-class-diagram-container { display: block; }
            </style>
            <script>${bundleJs}</script>
        </head>
        <body>
            <div id="container"></div>
        </body>
        </html>
    `;

    await page.setContent(html);

    const svg = await page.evaluate(({ type, text }) => {
        const container = document.getElementById('container');
        const RENDERERS = {
            class:      window.UMLClassDiagram,
            sequence:   window.UMLSequenceDiagram,
            state:      window.UMLStateDiagram,
            component:  window.UMLComponentDiagram,
            deployment: window.UMLDeploymentDiagram,
            usecase:    window.UMLUseCaseDiagram,
            activity:   window.UMLActivityDiagram,
        };
        const R = RENDERERS[type];
        if (!R) return 'Error: Unknown renderer type: ' + type;
        R.render(container, text);
        const svgEl = container.querySelector('svg');
        return svgEl ? svgEl.outerHTML : 'Error: No SVG generated';
    }, { type, text });

    await browser.close();

    if (!svg.startsWith('Error')) {
        fs.writeFileSync(cachePath, svg);
    }
    return svg;
}

// Batch mode if called with JSON input
if (require.main === module) {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    (async () => {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        const bundleJs = fs.readFileSync(BUNDLE_PATH, 'utf8');
        await page.setContent(`<html><head><script>${bundleJs}</script></head><body><div id="container"></div></body></html>`);

        const results = {};
        for (const [id, diagram] of Object.entries(input)) {
            const { type, text } = diagram;
            const hash = crypto.createHash('md5').update(type + text).digest('hex');
            const cachePath = path.join(CACHE_DIR, hash + '.svg');

            if (fs.existsSync(cachePath)) {
                results[id] = fs.readFileSync(cachePath, 'utf8');
                continue;
            }

            const svg = await page.evaluate(({ type, text }) => {
                const container = document.getElementById('container');
                container.innerHTML = '';
                const RENDERERS = {
                    class:      window.UMLClassDiagram,
                    sequence:   window.UMLSequenceDiagram,
                    state:      window.UMLStateDiagram,
                    component:  window.UMLComponentDiagram,
                    deployment: window.UMLDeploymentDiagram,
                    usecase:    window.UMLUseCaseDiagram,
                    activity:   window.UMLActivityDiagram,
                };
                const R = RENDERERS[type];
                if (!R) return 'Error: Unknown renderer type: ' + type;
                R.render(container, text);
                const svgEl = container.querySelector('svg');
                return svgEl ? svgEl.outerHTML : 'Error: No SVG generated';
            }, { type, text });

            if (!svg.startsWith('Error')) {
                fs.writeFileSync(cachePath, svg);
            }
            results[id] = svg;
        }
        await browser.close();
        process.stdout.write(JSON.stringify(results));
    })();
}
