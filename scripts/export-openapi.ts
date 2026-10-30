/**
 * Gera docs/openapi.json a partir dos schemas do código.
 * O GitHub Pages publica a pasta /docs com o Swagger UI.
 * Uso: npm run docs:export (o CI confere se o arquivo está atualizado).
 */
import { writeFileSync } from 'node:fs';
import { buildOpenApiDocument } from '../src/docs/openapi.js';

const doc = buildOpenApiDocument();
writeFileSync('docs/openapi.json', JSON.stringify(doc, null, 2) + '\n');
console.info('docs/openapi.json atualizado.');
