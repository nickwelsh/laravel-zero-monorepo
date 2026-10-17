import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';

export function checkWorkflow(source) {
    const workflow = parse(source);
    const errors = [];

    function checkUse(reference, location) {
        if (
            typeof reference !== 'string' ||
            (!reference.startsWith('./') && !/^[^@\s]+@[a-f0-9]{40}$/u.test(reference))
        ) {
            errors.push(`${location}: external actions and workflows must use a full commit SHA (got ${reference}).`);
        }
    }

    for (const [name, job] of Object.entries(workflow.jobs)) {
        if (Object.hasOwn(job, 'uses')) checkUse(job.uses, `jobs.${name}.uses`);
        for (const [index, step] of (job.steps ?? []).entries()) {
            if (Object.hasOwn(step, 'uses')) checkUse(step.uses, `jobs.${name}.steps[${index}].uses`);
        }
    }

    return errors;
}

if (import.meta.main) {
    const directory = new URL('../.github/workflows/', import.meta.url);
    const files = readdirSync(directory).filter((file) => /\.ya?ml$/u.test(file));
    for (const file of files) {
        const errors = checkWorkflow(readFileSync(new URL(file, directory), 'utf8'));
        for (const error of errors) console.error(`${file}: ${error}`);
        if (errors.length > 0) process.exitCode = 1;
    }
    if (!process.exitCode) console.log('All external GitHub Actions and reusable workflows use full commit SHAs.');
}
