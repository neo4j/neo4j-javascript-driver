/**
 * Auto-generate a version of the Neo4j "lite" JavaScript driver that works with Deno.
 * After it has been generated, this will load the new driver to test that it can
 * be initialized and that its typing is correct.
 *
 * See this folder's README.md for more details.
 *
 * Note: another approach would be to make the Deno version the primary version
 * and use DNT (https://github.com/denoland/dnt) to generate the NodeJS version,
 * but that seems too disruptive for now, and DNT is a new tool.
 */

import * as log from "https://deno.land/std@0.119.0/log/mod.ts";
import { parse } from "https://deno.land/std@0.119.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.119.0/fs/mod.ts";
import { join, relative } from "https://deno.land/std@0.119.0/path/mod.ts";

const isDir = (path: string) => {
  try {
    const stat = Deno.statSync(path);
    return stat.isDirectory;
  } catch {
    return false;
  }
};

////////////////////////////////////////////////////////////////////////////////
// Parse arguments
const parsedArgs = parse(Deno.args, {
  string: ["version", "output"],
  boolean: ["transform"], // Pass --no-transform to disable
  default: { transform: true },
  unknown: (arg) => {
    throw new Error(`Unknown argument "${arg}"`);
  },
});

// Should we rewrite imports or simply copy the files unmodified?
// Copying without changes can be useful to later generate a diff of the transforms
const doTransform = parsedArgs["transform"];
const version = parsedArgs.version ?? "0.0.0dev";

////////////////////////////////////////////////////////////////////////////////
// Clear out the destination folder
const rootOutDir = parsedArgs.output ?? "lib/";
await ensureDir(rootOutDir); // Make sure it exists
for await (const existingFile of Deno.readDir(rootOutDir)) {
  await Deno.remove(`${rootOutDir}${existingFile.name}`, { recursive: true });
}

////////////////////////////////////////////////////////////////////////////////
// Define our function that copies each file and transforms imports
async function copyAndTransform(inDir: string, outDir: string) {
  await ensureDir(outDir); // Make sure the target directory exists

  const relativeRoot = relative(outDir, rootOutDir) || "."; // relative path to rootOutDir
  const packageImportsMap = {
    'neo4j-driver-core': `${relativeRoot}/core/index.ts`,
    'neo4j-driver-bolt-connection': `${relativeRoot}/bolt-connection/index.js`,
    // Replace the 'buffer' npm package with the compatible implementation from the deno standard library
    'buffer': 'https://deno.land/std@0.119.0/node/buffer.ts',  // or can use 'https://esm.sh/buffer@6.0.3'
    // Replace the 'string_decoder' npm package with the compatible implementation from the deno standard library
    'string_decoder': 'https://deno.land/std@0.119.0/node/string_decoder.ts',  // or can use 'https://esm.sh/string_decoder@1.3.0'
  };

  // Recursively copy files from inDir to outDir
  for await (const existingFile of Deno.readDir(inDir)) {
    const inPath = join(inDir, existingFile.name);
    const outPath = join(outDir, existingFile.name);
    // If this is a directory, handle it recursively:
    if (existingFile.isDirectory) {
      await copyAndTransform(inPath, outPath);
      continue;
    }
    // At this point, this is a file. Copy it to the destination and transform it if needed.
    log.info(`Generating ${outPath}`);
    let contents = await Deno.readTextFile(inPath);

    // Transform: rewrite imports
    if (doTransform) {
      if (existingFile.name.endsWith(".ts")) {
        // Transform TypeScript imports:
        contents = contents.replaceAll(
          // Match an import or export statement, even if it has a '// comment' after it:
          / from '(\.[\w\/\.\-]+)'( \/\/.*)?$/gm,
          (_x, origPath) => {
            const newPath = isDir(`${inDir}/${origPath}`)
              ? `${origPath}/index.ts`
              : `${origPath}.ts`;
            return ` from '${newPath}'`;
          },
        );

        // Special fix. Replace:
        //  import { DirectConnectionProvider, RoutingConnectionProvider } from 'neo4j-driver-bolt-connection'
        // With:
        //  // @deno-types="../../bolt-connection/types"
        //  import { DirectConnectionProvider, RoutingConnectionProvider } from '../../bolt-connection/index.js'
        contents = contents.replace(
          /import {([^}]*)} from \'neo4j-driver-bolt-connection\'/,
          `// @deno-types="${relativeRoot}/bolt-connection/types/index.d.ts"\n` +
            `import {$1} from '${relativeRoot}/bolt-connection/index.js'`,
        );
      } else if (existingFile.name.endsWith(".js")) {

        // transform .js file imports in bolt-connection:
        contents = contents.replaceAll(
          / from '(\.[\w\/\.\-]+)'$/gm,
          (_x, origPath) => {
            const newPath = isDir(`${inDir}/${origPath}`)
              ? `${origPath}/index.js`
              : `${origPath}.js`;
            return ` from '${newPath}'`;
          },
        );

      }

      // Transforms which apply to both .js and .ts files, and which must come after the above transforms:
      if (
        existingFile.name.endsWith(".ts") || existingFile.name.endsWith(".js")
      ) {
        for (const [nodePackage, newImportUrl] of Object.entries(packageImportsMap)) {
          // Rewrite imports that use a Node.js package name (absolute imports):
          contents = contents.replaceAll(
            new RegExp(` from '${nodePackage}'$`, "gm"),
            ` from '${newImportUrl}'`,
          );
        }
      }

      // Special fix for bolt-connection/channel/index.js
      // Replace the "node channel" with the "deno channel", since Deno supports different APIs
      if (inPath.endsWith("channel/index.js")) {
        contents = contents.replace(
          `export * from './node/index.js'`,
          `export * from './deno/index.js'`,
        );
      }

    }

    await Deno.writeTextFile(outPath, contents);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Now generate the Deno driver

await copyAndTransform("../core/src", join(rootOutDir, "core"));
await copyAndTransform(
  "../bolt-connection/src",
  join(rootOutDir, "bolt-connection"),
);
await copyAndTransform(
  "../bolt-connection/types",
  join(rootOutDir, "bolt-connection", "types"),
);
await copyAndTransform("../neo4j-driver-lite/src", rootOutDir);
// Deno convention is to use "mod.ts" not "index.ts", so let's do that at least for the main/root import:
await Deno.rename(join(rootOutDir, "index.ts"), join(rootOutDir, "mod.ts"))
const copyright = await Deno.readTextFile("./copyright.txt");
await Deno.writeTextFile(
  join(rootOutDir, "version.ts"),
  [copyright, `export default "${version}" // Specified using --version when running generate.ts\n`].join('\n'),
);

////////////////////////////////////////////////////////////////////////////////
// Warnings show up at the end
if (!doTransform) {
  log.warning("Transform step was skipped.");
}
if (!parsedArgs.version) {
  log.warning(
    "No version specified. Specify a version like this: --version=4.4.0",
  );
}

////////////////////////////////////////////////////////////////////////////////
// Now test the driver
log.info("Testing the new driver (type checks only)");
const importPath = "./" + relative(".", join(rootOutDir, "mod.ts"));  // This is just ${rootOutDir}/index.ts but forced to start with "./"
await import(importPath);
log.info('Driver created and validated!');
