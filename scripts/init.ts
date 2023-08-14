import * as fs from "fs";
import * as path from "path";
import { exec } from "@actions/exec";

function removeSchemeUrl(inputString: string): string {
  const urlRegex: RegExp = /(https?:\/\/[^\s]+)/g;
  return inputString.replace(urlRegex, '",');
}

function removeComments(jsonc: string): string {
  return jsonc.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "");
}

const run = async (wsdir: string) => {
  const wsDirPath = path.resolve(wsdir);

  // sets wsdir env for dependent tasks usage
  process.env.WSDIR = wsdir;

  const wsFile = path.join(wsDirPath, "workspace.jsonc");
  const workspace = fs.readFileSync(wsFile).toString();

  // sets org and scope env for dependent tasks usage
  const workspaceJson = removeComments(removeSchemeUrl(workspace));
  const workspaceObject = JSON.parse(workspaceJson);
  const defaultScope = workspaceObject["teambit.workspace/workspace"].defaultScope;
  const [Org, Scope] = defaultScope.split(".");
  process.env.ORG = Org;
  process.env.SCOPE = Scope;

  // install bvm and bit
  const engineVersionMatch = /"engine": "(.*)"/.exec(workspace);
  const bitEngineVersion = engineVersionMatch ? engineVersionMatch[1] : "";
  await exec("npm i -g @teambit/bvm");
  await exec(`bvm install ${bitEngineVersion} --use-system-node`);
  // sets path for current step
  process.env.PATH = `${process.env.HOME}/bin:` + process.env.PATH;

  // config bit/npm for CI/CD
  process.env.BIT_CONFIG_ANALYTICS_REPORTING = "false";
  process.env.BIT_CONFIG_ANONYMOUS_REPORTING = "false";
  process.env.BIT_CONFIG_INTERACTIVE = "false";

  // bit compile before install dependencies
  await exec("bit compile", [], { cwd: wsdir }); //  fix error on bit install when there is use envs in the workspace.jsonc

  // bit install dependencies
  await exec("bit install --skip-compile", [], { cwd: wsdir });
};

export default run;
