import { join } from "https://deno.land/std@0.119.0/path/mod.ts";
import { parse } from "https://deno.land/std@0.119.0/flags/mod.ts";
import currentVersion from "./current.version.ts";

export async function setVersion (rootOutDir: string, version: string = currentVersion, filename: string = "version.ts") {
  const copyright = await Deno.readTextFile("./copyright.txt");
  await Deno.writeTextFile(
    join(rootOutDir, filename),
    [copyright, `export default "${version}" // Specified using --version when running generate.ts\n`].join('\n'),
  );
}

const thisFilePath = join(Deno.cwd().replace(" ", "%20"), 'versioning.ts');
if (Deno.mainModule.replace(" ", "%20").endsWith(thisFilePath)) {
  const parsedArgs = parse(Deno.args, {
    string: ["version", "output", 'filename'],
    unknown: (arg) => {
      throw new Error(`Unknown argument "${arg}"`);
    },
  });
  const rootOutDir = parsedArgs.output ?? "lib/";
  const version = parsedArgs.version;
  const filename = parsedArgs.filename
  await setVersion(rootOutDir, version, filename);
  console.log(`Finished set version to ${version}`);
}
