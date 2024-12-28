import prompts from "prompts";
import fs from "node:fs";

async function init() {
	return await prompts([
		{
			type: "text",
			name: "owner",
			message: "What is your GitHub username?"
		},
		{
			type: "text",
			name: "repo",
			message: "What is the name of the repository?"
		},
		{
			type: "text",
			name: "baseBranch",
			message: "What is the head branch?",
		},
		{
			type: "text",
			name: "newBranch",
			message: "What is the name of the branch that will be created from the head branch?",
		},
		{
			type: "password",
			name: "token",
			message: "Please enter your GitHub Token. You can create one at https://github.com/settings/tokens/new?scopes=repo,workflow"
		}
	]);
}

const answers = await init();
//write into .env file
const env = `OWNER=${answers.owner}\nREPO=${answers.repo}\nBASE_BRANCH=${answers.baseBranch}\nNEW_BRANCH=${answers.newBranch}\nTOKEN=${answers.token}`;
fs.writeFileSync(".env", env);
console.log("Configurations saved to .env file");



