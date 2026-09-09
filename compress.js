const fs = require("node:fs");
const path = require("node:path");
const { ZipArchive } = require("archiver");

const sourceDir = path.join(__dirname, "packages/browser/dist");
const outputPath = path.join(__dirname, "extension.zip");

const output = fs.createWriteStream(outputPath);
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on("close", () => {
  console.log(`Created extension.zip (${archive.pointer()} bytes)`);
});

archive.on("error", (error) => {
  throw error;
});

archive.on("warning", (error) => {
  throw error;
});

archive.pipe(output);
archive.directory(sourceDir, false);

archive.finalize();
