const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');
const parser = require('@babel/parser');
const story = yaml.load(readFileSync(require.resolve('../_data/explainers/react.yml'), 'utf8'));
const scene = (id) => story.scenes.find((item) => item.id === id);

// The same pinned React/Babel versions used by the interactive React tutorial.
const libraries = [
  'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.development.js',
  'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.development.js',
  'https://cdn.jsdelivr.net/npm/@babel/standalone@7.29.7/babel.min.js',
];

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><html lang="en"><head><title>Lesson example</title></head><body><main id="root"></main></body></html>');
  for (const url of libraries) await page.addScriptTag({ url });
});

async function mount(page, source, component) {
  await page.evaluate(({ source, component }) => {
    const compiled = Babel.transform(source, {
      presets: ['react'], plugins: ['transform-modules-commonjs'],
    }).code;
    const loadModule = (name) => {
      if (name !== 'react') throw new Error(`Unexpected lesson import: ${name}`);
      return React;
    };
    const Component = new Function('React', 'useState', 'useEffect', 'require', `${compiled}\nreturn ${component};`)(
      React, React.useState, React.useEffect, loadModule);
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));
  }, { source, component });
}

test('JSX evaluates the title and props produce separate component outputs', async ({ page }) => {
  await mount(page, scene('props').code, 'App');
  await expect(page.getByRole('heading')).toHaveText(['React', 'Node.js']);
});

test('state starts at zero and the click callback produces one update per click', async ({ page }) => {
  await mount(page, scene('events').code, 'LikeButton');
  await expect(page.getByRole('button')).toHaveText('Like: 0');
  await page.getByRole('button').click();
  await expect(page.getByRole('button')).toHaveText('Like: 1');
  await page.getByRole('button').click();
  await expect(page.getByRole('button')).toHaveText('Like: 2');
});

for (const [variant, expected] of [['code', 'Like: 1'], ['alternate_code', 'Like: 2']]) {
  test(`the ${variant === 'code' ? 'replacement' : 'updater'} prediction agrees with React`, async ({ page }) => {
    const source = scene('events').code;
    const component = parser.parse(source, { plugins: ['jsx'] }).program.body[0];
    const handler = component.body.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'handleLike');
    const example = source.slice(0, handler.start) + scene('updates')[variant] + source.slice(handler.end);
    await mount(page, example, 'LikeButton');
    await page.getByRole('button').click();
    await expect(page.getByRole('button')).toHaveText(expected);
  });
}

test('a child callback updates both views and the effect synchronizes the document title', async ({ page }) => {
  const source = scene('shared').code;
  const component = parser.parse(source, { plugins: ['jsx'] }).program.body[0];
  const returned = component.body.body.find((node) => node.type === 'ReturnStatement');
  const example = source.slice(0, returned.start) + scene('effects').code + '\n' + source.slice(returned.start);
  await mount(page, `${example}\n${scene('shared').alternate_code}`, 'Course');
  await expect(page).toHaveTitle('Likes: 0');
  await page.getByRole('button').click();
  await expect(page.getByRole('button')).toHaveText('Like: 1');
  await expect(page.getByText('Total: 1', { exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Likes: 1');
});

test('reordering preserves keyed item identity without mutating the previous state array', async ({ page }) => {
  const source = `${scene('lists').code}
    function App() {
      const [courses, setCourses] = useState(Object.freeze([
        Object.freeze({ id: 'r', title: 'React' }),
        Object.freeze({ id: 'n', title: 'Node.js' })
      ]));
      ${scene('lists').alternate_code}
      return <><button onClick={reverseOrder}>Reverse</button><CourseList courses={courses} /></>;
    }`;
  await mount(page, source, 'App');
  await expect(page.getByRole('listitem')).toHaveText(['React', 'Node.js']);
  const original = await page.getByRole('listitem').filter({ hasText: /^React$/ }).elementHandle();
  await page.getByRole('button', { name: 'Reverse' }).click();
  await expect(page.getByRole('listitem')).toHaveText(['Node.js', 'React']);
  expect(await page.getByRole('listitem').filter({ hasText: /^React$/ }).evaluate((item, before) => item === before, original)).toBe(true);
});
