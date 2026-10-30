import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

/** A senha nunca é salva em texto puro: guardamos apenas o hash bcrypt. */
export const hashPassword = (plain: string) => bcrypt.hash(plain, env.BCRYPT_ROUNDS);
export const comparePassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
