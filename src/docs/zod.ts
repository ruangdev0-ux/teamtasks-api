/**
 * Zod com suporte a .openapi(): os mesmos schemas validam as requisições
 * e geram a documentação OpenAPI, então docs e código não ficam desalinhados.
 */
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);
// Mensagens de validação em português (ex.: "Muito pequeno: esperado...").
z.config(z.locales.pt());

export { z };

export const uuidParam = (name: string) =>
  z.object({ [name]: z.uuid({ message: `${name} precisa ser um UUID.` }) });
