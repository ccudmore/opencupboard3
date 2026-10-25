import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '$env/dynamic/private';

// Email templates are plain text files in ./templates (one per message).
//
// File format:
//   Subject: Your appointment on {{date}}
//   <blank line>
//   Body text, with {{placeholders}} anywhere.
//
// Every .txt file in ./templates is compiled into the server build, so editing a
// template means rebuilding the image. To change templates without a rebuild,
// mount a folder of .txt files and set EMAIL_TEMPLATE_DIR to its path in the
// container; files found there win over the built-in ones.
const bundled = import.meta.glob('./templates/*.txt', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

export type TemplateVars = Record<string, string>;

/** Replaces {{name}} with vars.name. Unknown placeholders become empty text. */
export function fill(text: string, vars: TemplateVars): string {
	return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? '');
}

/** Splits a template file into its subject line and body. */
export function parseTemplate(raw: string): { subject: string; body: string } {
	const text = raw.replace(/\r\n/g, '\n');
	const match = text.match(/^Subject:[ \t]*(.*)\n+([\s\S]*)$/);
	return match ? { subject: match[1].trim(), body: match[2] } : { subject: '', body: text };
}

/** Collapses the blank lines left behind by placeholders that were empty. */
function tidy(text: string): string {
	return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

async function loadTemplate(name: string): Promise<string> {
	if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid email template name "${name}"`);

	if (env.EMAIL_TEMPLATE_DIR) {
		try {
			return await readFile(join(env.EMAIL_TEMPLATE_DIR, `${name}.txt`), 'utf8');
		} catch {
			// not in the override folder: use the built-in one
		}
	}

	const template = bundled[`./templates/${name}.txt`];
	if (template === undefined) throw new Error(`Email template "${name}" was not found`);
	return template;
}

export async function renderTemplate(name: string, vars: TemplateVars): Promise<{ subject: string; body: string }> {
	const { subject, body } = parseTemplate(await loadTemplate(name));
	return {
		subject: fill(subject, vars).replace(/\s+/g, ' ').trim() || 'Message',
		body: tidy(fill(body, vars))
	};
}
