// Assemble un .vsix sans dépendance (un .vsix est une archive zip).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const out = path.join(root, "dist", `${pkg.name}-${pkg.version}.vsix`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vsix-"));

fs.mkdirSync(path.join(tmp, "extension"));
for (const entry of ["package.json", "README.md", "src", "media"]) {
    fs.cpSync(path.join(root, entry), path.join(tmp, "extension", entry), { recursive: true });
}

fs.writeFileSync(
    path.join(tmp, "[Content_Types].xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension=".json" ContentType="application/json"/>
<Default Extension=".js" ContentType="application/javascript"/>
<Default Extension=".md" ContentType="text/markdown"/>
<Default Extension=".svg" ContentType="image/svg+xml"/>
<Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>
`
);

fs.writeFileSync(
    path.join(tmp, "extension.vsixmanifest"),
    `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
<Metadata>
<Identity Language="en-US" Id="${pkg.name}" Version="${pkg.version}" Publisher="${pkg.publisher}"/>
<DisplayName>${pkg.displayName}</DisplayName>
<Description xml:space="preserve">${pkg.description}</Description>
<Categories>Other</Categories>
</Metadata>
<Installation><InstallationTarget Id="Microsoft.VisualStudio.Code" Version="${pkg.engines.vscode}"/></Installation>
<Dependencies/>
<Assets>
<Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
<Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>
</Assets>
</PackageManifest>
`
);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });
execFileSync("zip", ["-qr", out, "[Content_Types].xml", "extension.vsixmanifest", "extension"], { cwd: tmp });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Créé : ${out}`);
