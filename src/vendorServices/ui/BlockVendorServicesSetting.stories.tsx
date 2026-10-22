import type { Meta, StoryObj } from "@/lib/story";
import {
  BlockVendorServicesSetting,
  type BlockVendorServicesSettingProps,
} from "./BlockVendorServicesSetting";

const meta = {
  title: "Settings/Block Vendor Services",
  component: BlockVendorServicesSetting,
  args: { blocked: true, onBlockedChange: () => undefined },
  parameters: { gallery: { host: "settings-tab", layout: "padded" } },
} satisfies Meta<BlockVendorServicesSettingProps>;
export default meta;

export const Blocked: StoryObj<BlockVendorServicesSettingProps> = {};

export const Allowed: StoryObj<BlockVendorServicesSettingProps> = {
  args: { blocked: false },
};
