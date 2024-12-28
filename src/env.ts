declare module "bun" {
	interface Env {
		OWNER: string;
		REPO: string;
		BASE_BRANCH: string;
		NEW_BRANCH: string;
		TOKEN: string;
	}
}
