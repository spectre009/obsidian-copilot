import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");

const VENDOR_MARKERS =
  /brevilabs\.com|openartifacts\.ai|obsidiancopilot\.com|BREVILABS_API_BASE_URL|BREVILABS_MODELS_BASE_URL|BrevilabsClient\.getInstance|OpenArtifactsClient|createReportUploader|PRODUCT_URLS/;

// Each file here was checked for a vendor request, spawn, or page load guarded by the vendor-services
// policy; a new entry needs the same review before it joins the list.
// https://github.com/spectre009/obsidian-copilot/issues/1
const REVIEWED_VENDOR_FILES = [
  "LLMProviders/brevilabsClient.ts",
  "LLMProviders/chatModelManager.ts",
  "agentMode/backends/shared/builtinSkillEnv.ts",
  "agentMode/backends/shared/copilotPlusUsage.ts",
  "agentMode/ui/ReportIssueModal.tsx",
  "builtinSkills/builtinSkills.ts",
  "components/PreviewUpsellHint.tsx",
  "components/chat-components/RelevantNotes.tsx",
  "components/modals/CopilotPlusWelcomeModal.tsx",
  "components/modals/OpenArtifactsModal.tsx",
  "components/modals/YoutubeTranscriptModal.tsx",
  "components/ui/ModelEffortPicker.tsx",
  "components/ui/ModelEnableList.tsx",
  "components/ui/ModelSelector.tsx",
  "constants.ts",
  "lib/productLinks.ts",
  "main.ts",
  "mentions/Mention.ts",
  "miyo/settings/MiyoSettings.tsx",
  "modelManagement/setup/copilotPlusSync.ts",
  "openArtifacts/OpenArtifactsClient.ts",
  "openArtifacts/OpenArtifactsPublisher.ts",
  "openArtifacts/constants.ts",
  "plusUtils.ts",
  "settings/v2/components/PlusSettings.tsx",
  "tools/SearchTools.ts",
  "tools/YoutubeTools.ts",
  "utils/reportUpload.brevilabs.ts",
  "vendorServices/vendorServicesPolicy.ts",
];

function productionSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(full);
    if (!/\.tsx?$/.test(entry.name) || /\.(test|stories)\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

function filesNamingAVendor(): string[] {
  return productionSourceFiles(SRC_ROOT)
    .filter((file) => VENDOR_MARKERS.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(SRC_ROOT, file).split(path.sep).join("/"))
    .sort((a, b) => a.localeCompare(b));
}

describe("vendorEgressInventory", () => {
  it("finds vendor hosts and clients only in files reviewed for the vendor-services block, so an upstream merge that adds one fails here — https://github.com/spectre009/obsidian-copilot/issues/1", () => {
    expect(filesNamingAVendor()).toEqual(
      [...REVIEWED_VENDOR_FILES].sort((a, b) => a.localeCompare(b))
    );
  });
});
