import { pathToFileURL } from 'url';
import { resolve as pathResolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let path;
    if (specifier.includes('config')) {
      // Handle config imports - they're in the root config/ directory
      path = specifier.replace('@/config/', './config/');
    } else {
      // Handle other imports - they're in the src/ directory
      path = specifier.replace('@/', './src/');
    }
    return {
      shortCircuit: true,
      url: pathToFileURL(pathResolve(__dirname, path)).href
    };
  }
  return nextResolve(specifier, context);
}
