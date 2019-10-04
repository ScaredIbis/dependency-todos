const child_process = require("child_process");
const fs = require("fs");
const readline = require("readline");

async function readTodosForPackage(package) {
  // download the package archive and get the file name
  const archiveName = child_process.execSync(`npm pack ${package}`).toString();
  const fileExtensionIndex = archiveName.lastIndexOf(".tgz");

  const outputDir = `autogen/${archiveName.substring(0, fileExtensionIndex)}`;

  if(fs.existsSync(outputDir)) {
    child_process.execSync(`rm -r ${outputDir}`);
  }

  child_process.execSync(`mkdir -p ${outputDir} && tar --directory ${outputDir} -xzf ${archiveName}`);

  const todos = {};

  async function recursiveWalk(dir) {
    const files = fs.readdirSync(dir);

    // read all extracted files
    for(let file of files) {
      file = dir + '/' + file;
      const stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        // its a subdirectory
        await recursiveWalk(file);
      } else if(file.endsWith(".js")) {

        // we found a javascript file
        const contentBuffer = fs.readFileSync(file);
        // see if it has any todo's
        if(contentBuffer.includes("TODO") || contentBuffer.includes("todo")) {
          const filePath = file.replace(outputDir, "")
          todos[filePath] = {};

          const lines = [];

          const readInterface = readline.createInterface({
            input: fs.createReadStream(file)
          });

          let lineNumber = 1;
          // TODO: don't store every line we see in memory
          await new Promise(resolve => {
            readInterface.on('line', function(line) {
              lineNumber += 1;
              lines.push(line);

            }).on("close", resolve)
          });

          for (const line of lines) {
            if(line.includes("TODO") || line.includes("todo")) {
              todos[filePath][lineNumber] = lines.slice(Math.min(0, lineNumber - 10), lineNumber + 10).join("\n");
            }
          }
        }
      }
    }
  }

  await recursiveWalk(outputDir);

  return todos
}

readTodosForPackage(process.argv[2]);