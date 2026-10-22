import type { Meta, StoryObj } from "@/lib/story";
import {
  BackgroundModelSetting,
  SAME_AS_CHAT_MODEL,
  type BackgroundModelSettingProps,
} from "./BackgroundModelSetting";

const OPTIONS = [
  { label: "Claude Haiku 4.5", value: "haiku" },
  { label: "Claude Sonnet 5.5", value: "sonnet" },
  { label: "GPT-6.1 Sol", value: "sol" },
];

const meta = {
  title: "Settings/Quick Chat background model",
  component: BackgroundModelSetting,
  args: {
    value: "haiku",
    options: OPTIONS,
    onChange: () => undefined,
    thinkingLevel: "low",
    onThinkingLevelChange: () => undefined,
  },
  parameters: { gallery: { host: "settings-tab", layout: "padded" } },
} satisfies Meta<BackgroundModelSettingProps>;
export default meta;

export const CheapCopilotModel: StoryObj<BackgroundModelSettingProps> = {};

export const SameAsChatModel: StoryObj<BackgroundModelSettingProps> = {
  args: { value: SAME_AS_CHAT_MODEL },
};
