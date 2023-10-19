import { join } from "https://deno.land/std@0.119.0/path/mod.ts";
import { parse } from "https://deno.land/std@0.119.0/flags/mod.ts";

export async function setVersion (rootOutDir: string, version: string) {
  const copyright = await Deno.readTextFile("./copyright.txt");
  await Deno.writeTextFile(
    join(rootOutDir, "version.ts"),
    [copyright, `export default "${version}" // Specified using --version when running generate.ts\n`].join('\n'),
  );
}

const thisFilePath = join(Deno.cwd(), 'versioning.ts');
if (Deno.mainModule.endsWith(thisFilePath)) {
  const parsedArgs = parse(Deno.args, {
    string: ["version", "output"],
    unknown: (arg) => {
      throw new Error(`Unknown argument "${arg}"`);
    },
  });
  const rootOutDir = parsedArgs.output ?? "lib/";
  const version = parsedArgs.version ?? "0.0.0dev";
  await setVersion(rootOutDir, version);
  console.log(`Finished set version to ${version}`);
}
