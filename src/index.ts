import fs from "node:fs";
import path from "node:path";
import type { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
import { program } from "commander";
import normalize from "normalize-path";

const octokit = new Octokit({
	auth: process.env.TOKEN,
});

async function branchExists(
	owner: string,
	repo: string,
	branch: string,
): Promise<boolean> {
	try {
		await octokit.repos.getBranch({ owner, repo, branch });
		return true;
	} catch (error) {
		if ((error as RequestError).status === 404) return false;
		throw error;
	}
}

async function createOrGetBranch(
	owner: string,
	repo: string,
	baseBranch: string,
	newBranch: string,
): Promise<void> {
	if (await branchExists(owner, repo, newBranch)) {
		console.log(`Branch ${newBranch} already exists.`);
		return;
	}

	const baseBranchData = await octokit.repos.getBranch({
		owner,
		repo,
		branch: baseBranch,
	});
	const baseSha = baseBranchData.data.commit.sha;

	await octokit.git.createRef({
		owner,
		repo,
		ref: `refs/heads/${newBranch}`,
		sha: baseSha,
	});
	console.log(`Branch ${newBranch} created from ${baseBranch}`);
}

async function upsertFile(
	owner: string,
	repo: string,
	branch: string,
	filePath: string,
	content: string,
): Promise<void> {
	const encodedContent = Buffer.from(content).toString("base64");

	try {
		const fileData = await octokit.repos.getContent({
			owner,
			repo,
			path: filePath,
			ref: branch,
		});

		if ("sha" in fileData.data) {
			await octokit.repos.createOrUpdateFileContents({
				owner,
				repo,
				path: filePath,
				message: `Update ${filePath}`,
				content: encodedContent,
				branch,
				sha: fileData.data.sha,
			});
			console.log(`File ${filePath} updated on branch ${branch}`);
		}
	} catch (error) {
		if ((error as RequestError).status === 404) {
			await octokit.repos.createOrUpdateFileContents({
				owner,
				repo,
				path: filePath,
				message: `Create ${filePath}`,
				content: encodedContent,
				branch,
			});
			console.log(`File ${filePath} created on branch ${branch}`);
		} else {
			throw error;
		}
	}
}

async function createPullRequest(
	owner: string,
	repo: string,
	baseBranch: string,
	featureBranch: string,
	title: string,
): Promise<number> {
	const pr = await octokit.pulls.create({
		owner,
		repo,
		title,
		head: featureBranch,
		base: baseBranch,
	});
	console.log(`Pull request created: ${pr.data.html_url}`);
	return pr.data.number;
}

async function mergeBranch(
	owner: string,
	repo: string,
	baseBranch: string,
	pullNumber: number,
): Promise<void> {
	try {
		await octokit.pulls.merge({
			owner,
			repo,
			pull_number: pullNumber,
		});
		console.log(`Pull Request #${pullNumber} merged into ${baseBranch}`);
	} catch (error) {
		console.log(`Unable to merge Pull Request #${pullNumber}:`, error);
	}
}

async function processMarkdownFiles(
	owner: string,
	repo: string,
	branch: string,
	files: string[],
): Promise<void> {
	for (const file of files) {
		if (!fs.existsSync(file)) {
			console.error(`File not found: ${file}`);
			continue;
		}

		const content = fs.readFileSync(file, "utf-8");
		const filepath = normalize(path.relative(process.cwd(), file));
		await upsertFile(owner, repo, branch, filepath, content);
	}
}

function parseValues(optFiles: string[]): string[] {
	const files = [];
	for (const file of optFiles) {
		if (fs.lstatSync(file).isDirectory()) {
			const filesInDir = fs.readdirSync(file).filter((f) => f.endsWith(".md"));
			files.push(
				...filesInDir.map((f) => {
					return path.resolve(file, f);
				}),
			);
		} else {
			files.push(path.resolve(file));
		}
	}
	return files;
}

async function main() {
	const owner = process.env.OWNER;
	const repo = process.env.REPO;
	const baseBranch = process.env.BASE_BRANCH;
	const newBranch = process.env.NEW_BRANCH;

	program.option(
		"--file [file...]",
		"Specify one or more markdown files to upload",
	);
	program.parse(process.argv);
	const options = program.opts();
	const optFiles =
		options.file ||
		fs.readdirSync("dummy").filter((file) => file.endsWith(".md"));
	if (optFiles.length === 0) {
		throw new Error("No markdown files found");
	}
	const files = parseValues(optFiles);

	if (!(await branchExists(owner, repo, baseBranch))) {
		throw new Error(`Base branch ${baseBranch} does not exist.`);
	}
	await createOrGetBranch(owner, repo, baseBranch, newBranch);
	await processMarkdownFiles(owner, repo, newBranch, files);
	const prNumber = await createPullRequest(
		owner,
		repo,
		baseBranch,
		newBranch,
		"Add example file",
	);
	await mergeBranch(owner, repo, baseBranch, prNumber);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
