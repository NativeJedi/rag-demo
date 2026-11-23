import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Case, DatasetSchema } from './case';

export const DATASET_FILE = join(__dirname, '..', '..', 'dataset.json');

export function loadDataset(): Case[] {
  return DatasetSchema.parse(JSON.parse(readFileSync(DATASET_FILE, 'utf8')));
}

export function saveDataset(cases: Case[]): void {
  writeFileSync(DATASET_FILE, `${JSON.stringify(cases, null, 2)}\n`);
}
